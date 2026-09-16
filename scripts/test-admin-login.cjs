const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('RUNNING ADMIN LOGIN CREDENTIALS & SESSIONS TEST SUITE');
console.log('================================================================\n');

// 1. Ensure DB is setup
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'shondani.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

function createAdminSession(username) {
  const token = 'admin_session_' + Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString('base64url');
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO admin_sessions (token, username, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, username, now, expires);
  return token;
}

function verifyAdminSession(token) {
  if (!token) return false;
  const now = new Date().toISOString();
  const row = db.prepare('SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?').get(token, now);
  return Boolean(row);
}

function verifyAdminCredentials(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  const isValidUser = cleanUser === 'omar' || cleanUser === 'omar2993' || cleanUser === 'admin';
  const isValidPass = cleanPass === 'Omar88067' || cleanPass.toLowerCase() === 'omar88067';

  if (isValidUser && isValidPass) {
    const token = createAdminSession('omar');
    return {
      success: true,
      data: {
        role: 'admin',
        token,
      },
    };
  }

  return {
    success: false,
    error: 'Invalid admin username or password. Access denied.',
  };
}

// Test Cases
const testCases = [
  { user: 'omar', pass: 'Omar88067', desc: 'Standard credentials (exact casing)' },
  { user: 'Omar', pass: 'Omar88067', desc: 'Capitalized username (mobile keyboard default)' },
  { user: 'OMAR', pass: 'Omar88067', desc: 'Uppercase username' },
  { user: ' omar ', pass: ' Omar88067 ', desc: 'Whitespace padded username & password' },
  { user: 'omar', pass: 'omar88067', desc: 'Lowercase password' },
  { user: 'Omar', pass: 'omar88067', desc: 'Capitalized username + lowercase password' },
  { user: 'omar2993', pass: 'Omar88067', desc: 'GitHub / Repo handle as username' },
  { user: 'Omar2993', pass: 'Omar88067', desc: 'Capitalized GitHub handle as username' },
  { user: 'admin', pass: 'Omar88067', desc: '"admin" as username' },
  { user: 'Admin', pass: 'Omar88067', desc: '"Admin" as username' },
];

let passed = 0;
for (const tc of testCases) {
  const res = verifyAdminCredentials(tc.user, tc.pass);
  assert.strictEqual(res.success, true, `Should succeed for: ${tc.desc}`);
  assert(res.data.token.startsWith('admin_session_'), 'Should return valid admin session token');
  assert.strictEqual(verifyAdminSession(res.data.token), true, 'Returned session token must be verifiable in DB');
  passed++;
  console.log(`✓ PASS: ${tc.desc} (user="${tc.user}", pass="${tc.pass}")`);
}

// Negative test cases
console.log('\nTesting Invalid Credentials rejection:');
const negativeCases = [
  { user: '', pass: 'Omar88067', desc: 'Empty username' },
  { user: 'omar', pass: '', desc: 'Empty password' },
  { user: 'wrong_user', pass: 'Omar88067', desc: 'Wrong username' },
  { user: 'omar', pass: 'wrong_password', desc: 'Wrong password' },
  { user: 'guest', pass: '123456', desc: 'Completely wrong credentials' },
];

for (const tc of negativeCases) {
  const res = verifyAdminCredentials(tc.user, tc.pass);
  assert.strictEqual(res.success, false, `Should fail for: ${tc.desc}`);
  console.log(`✓ PASS: Rejection verified for ${tc.desc}`);
  passed++;
}

console.log('\n================================================================');
console.log(`ALL ADMIN LOGIN TESTS PASSED (${passed}/${passed})`);
console.log('================================================================');
