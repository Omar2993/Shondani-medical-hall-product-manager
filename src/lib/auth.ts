import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'shondani_admin_session';

export interface AdminSessionPayload {
  username: string;
  role: 'admin';
  iat: number;
  exp: number;
  sid: string;
}

// In-memory revocation cache across active requests on the instance
const revokedTokensSet = new Set<string>();

/**
 * Resolves configured Admin credentials from production environment variables
 * with reliable fallbacks for local development.
 */
export function getAdminCredentials(): { configuredUser: string; configuredPass: string } {
  const configuredUser = (process.env.ADMIN_USERNAME || 'Omar').trim();
  const configuredPass = (process.env.ADMIN_PASSWORD || 'Omar88067').trim();
  return { configuredUser, configuredPass };
}

/**
 * Resolves cryptographic secret for session signing.
 * Uses AUTH_SECRET or SESSION_SECRET if configured in production.
 * If not set, derives a deterministic HMAC secret from ADMIN_PASSWORD and an internal salt,
 * ensuring that all serverless lambdas share the exact same key without coordination.
 */
export function getAuthSecret(): string {
  const customSecret = process.env.AUTH_SECRET || process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (customSecret && customSecret.trim()) {
    return customSecret.trim();
  }
  const { configuredUser, configuredPass } = getAdminCredentials();
  return crypto
    .createHash('sha256')
    .update(`shondani_auth_${configuredUser}_${configuredPass}_production_salt_2026`)
    .digest('hex');
}

/**
 * Cookie options tailored for deployed production HTTPS domains and local dev.
 */
export function getAdminCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  };
}

/**
 * Creates a cryptographically signed, stateless session token.
 * Token format: admin_session_${payloadBase64}.${signature}
 */
export function createAdminSession(username: string = 'Omar'): string {
  const now = Date.now();
  const exp = now + 30 * 24 * 60 * 60 * 1000; // 30 days
  const sid = crypto.randomUUID();

  const payload: AdminSessionPayload = {
    username: username || 'Omar',
    role: 'admin',
    iat: now,
    exp,
    sid,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payloadBase64)
    .digest('base64url');

  const token = `admin_session_${payloadBase64}.${signature}`;

  // Optionally record in database if database is available
  try {
    // Dynamic require to prevent circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRawDb } = require('./db');
    const db = getRawDb();
    if (db) {
      db.prepare(`
        INSERT INTO admin_sessions (token, username, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(token, username, new Date(now).toISOString(), new Date(exp).toISOString());
    }
  } catch {
    // Non-fatal: session remains 100% valid via cryptographic HMAC signature
  }

  return token;
}

/**
 * Verifies whether an admin session token is valid and not expired.
 * Supports both cryptographically signed tokens (serverless-proof) and legacy DB tokens.
 */
export function verifyAdminSession(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith('admin_session_')) return false;

  // Check in-memory revocation list
  if (revokedTokensSet.has(token)) return false;

  const rawPart = token.slice('admin_session_'.length);

  // 1. Signed token verification (payload.signature)
  if (rawPart.includes('.')) {
    const dotIndex = rawPart.indexOf('.');
    const payloadBase64 = rawPart.slice(0, dotIndex);
    const signature = rawPart.slice(dotIndex + 1);

    if (!payloadBase64 || !signature) return false;

    // Verify HMAC signature using timingSafeEqual
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(payloadBase64)
      .digest('base64url');

    try {
      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length) return false;
      if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

      // Decode payload
      const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload: AdminSessionPayload = JSON.parse(jsonStr);

      // Check role and expiration
      if (payload.role !== 'admin') return false;
      if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;

      // Check DB revocation table if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getRawDb } = require('./db');
        const db = getRawDb();
        if (db) {
          const revokedRow = db.prepare('SELECT token FROM revoked_sessions WHERE token = ?').get(token);
          if (revokedRow) {
            revokedTokensSet.add(token);
            return false;
          }
        }
      } catch {
        // If DB not available, cryptographic signature is authoritative
      }

      return true;
    } catch {
      return false;
    }
  }

  // 2. Fallback: Legacy database session lookup (for local test suites / existing DB records)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRawDb } = require('./db');
    const db = getRawDb();
    if (db) {
      const now = new Date().toISOString();
      const row = db.prepare('SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?').get(token, now);
      return Boolean(row);
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Revokes an admin session token.
 */
export function revokeAdminSession(token: string | null | undefined): void {
  if (!token) return;
  revokedTokensSet.add(token);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRawDb } = require('./db');
    const db = getRawDb();
    if (db) {
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO revoked_sessions (token, revoked_at) VALUES (?, ?)').run(token, now);
      db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    }
  } catch {
    // In-memory revocation still takes effect
  }
}

/**
 * Sets the admin session cookie in the HTTP response.
 */
export async function setAdminSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
  } catch (err) {
    console.warn('Unable to set admin session cookie in this context:', err);
  }
}

/**
 * Clears the admin session cookie from the HTTP response.
 */
export async function clearAdminSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, '', {
      ...getAdminCookieOptions(),
      maxAge: 0,
    });
  } catch (err) {
    console.warn('Unable to clear admin session cookie:', err);
  }
}

/**
 * Reads the admin session token from incoming HTTP request cookies.
 */
export async function getAdminSessionTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ADMIN_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}
