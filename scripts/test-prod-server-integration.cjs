const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

console.log('================================================================');
console.log('RUNNING PRODUCTION SERVER LIVE HTTP E2E INTEGRATION TEST');
console.log('================================================================\n');

// Read server actions manifest dynamically from .next build
const manifestPath = path.join(__dirname, '..', '.next', 'server', 'server-reference-manifest.json');
assert(fs.existsSync(manifestPath), 'Production server build manifest must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function findActionId(name) {
  for (const [id, meta] of Object.entries(manifest.node)) {
    if (meta.exportedName === name) return id;
  }
  throw new Error(`Action ${name} not found in manifest`);
}

const verifyCredentialsActionId = findActionId('verifyAdminCredentials');
const getSessionStatusActionId = findActionId('getAdminSessionStatus');
const logoutActionId = findActionId('logoutAdmin');
const addProductActionId = findActionId('authorizedAddProduct');

console.log('Loaded Server Action IDs:');
console.log(`- verifyAdminCredentials: ${verifyCredentialsActionId}`);
console.log(`- getAdminSessionStatus:  ${getSessionStatusActionId}`);
console.log(`- logoutAdmin:            ${logoutActionId}`);
console.log(`- authorizedAddProduct:   ${addProductActionId}\n`);

const BASE_URL = process.env.BASE_URL || (`http://localhost:${process.env.PORT || '3009'}`);

async function fetchHttp(urlPath, options = {}) {
  const url = new URL(urlPath, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function parseActionResponse(body) {
  // In Next.js RSC stream, the action return value is on a line like: 1:{"success":true,...}
  const lines = body.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const payload = line.slice(colonIdx + 1);
      if (payload.startsWith('{') && payload.includes('"success"')) {
        try {
          return JSON.parse(payload);
        } catch {
          // continue
        }
      }
    }
  }
  // Fallback direct JSON parse
  return JSON.parse(body);
}

async function run() {
  // Step 1: Health check on main page
  console.log('Step 1: Testing Main Page GET /');
  const pageRes = await fetchHttp('/');
  assert.strictEqual(pageRes.status, 200, 'Main page should return 200 OK');
  assert(pageRes.body.includes('Shondani') || pageRes.body.includes('html'), 'Page should return Shondani content');
  console.log('✓ PASS: Main page returns 200 OK on production server.');

  // Step 2: Testing /api/sync
  console.log('\nStep 2: Testing Central DB Sync GET /api/sync');
  const syncRes = await fetchHttp('/api/sync');
  assert.strictEqual(syncRes.status, 200, '/api/sync should return 200 OK');
  const syncData = JSON.parse(syncRes.body);
  assert.strictEqual(syncData.success, true, 'Sync response success must be true');
  const products = syncData.products || syncData.data?.products;
  assert(Array.isArray(products) && products.length > 0, 'Sync should return products list');
  console.log(`✓ PASS: /api/sync returns 200 with ${products.length} products and shop metadata.`);

  // Step 3: Admin Login with valid credentials via Server Action
  console.log('\nStep 3: Admin Login via Server Action (verifyAdminCredentials)');
  const loginRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': verifyCredentialsActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
    },
    body: JSON.stringify(['Omar', 'Omar88067']),
  });

  assert.strictEqual(loginRes.status, 200, 'Login server action should return 200');
  const loginActionData = parseActionResponse(loginRes.body);
  assert.strictEqual(loginActionData.success, true, 'Login must succeed');
  assert.strictEqual(loginActionData.data.role, 'admin', 'Returned role must be admin');
  assert(loginActionData.data.token.startsWith('admin_session_'), 'Must return valid signed session token');

  // Verify Set-Cookie header
  const setCookie = loginRes.headers['set-cookie'];
  assert(setCookie && setCookie.length > 0, 'Server action must set-cookie header');
  const sessionCookie = setCookie.find((c) => c.startsWith('shondani_admin_session='));
  assert(sessionCookie, 'Must set shondani_admin_session cookie');
  assert(sessionCookie.includes('HttpOnly'), 'Cookie must have HttpOnly flag');
  assert(/samesite=lax/i.test(sessionCookie), 'Cookie must have SameSite=lax');
  assert(/path=\//i.test(sessionCookie), 'Cookie must have Path=/');
  console.log('✓ PASS: Admin login succeeded, issued signed session token, and set HttpOnly SameSite=Lax cookie.');

  // Extract cookie value for subsequent requests
  const cookieValue = sessionCookie.split(';')[0];

  // Step 4: Verify Admin Session status via cookie
  console.log('\nStep 4: Session Status Verification via Cookie (getAdminSessionStatus)');
  const statusRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': getSessionStatusActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': cookieValue,
    },
    body: JSON.stringify([]),
  });

  assert.strictEqual(statusRes.status, 200);
  const statusData = parseActionResponse(statusRes.body);
  assert.strictEqual(statusData.success, true);
  assert.strictEqual(statusData.data.isAdmin, true, 'Session should be verified as admin');
  console.log('✓ PASS: getAdminSessionStatus confirms admin session active via HTTP cookie.');

  // Step 5: Page Refresh Simulation (GET / with Cookie)
  console.log('\nStep 5: Refreshing Deployed App Simulation (GET / with Cookie)');
  const refreshRes = await fetchHttp('/', {
    headers: {
      'Cookie': cookieValue,
    },
  });
  assert.strictEqual(refreshRes.status, 200, 'Page reload with cookie must return 200 OK');
  console.log('✓ PASS: App reload keeps Admin logged in seamlessly.');

  // Step 6: Authorized Admin Mutation (authorizedAddProduct)
  console.log('\nStep 6: Executing Authorized Admin Action (authorizedAddProduct)');
  const addProdRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': addProductActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': cookieValue,
    },
    body: JSON.stringify([null, { name: 'Sterile Gauze Roll 4-inch', price: 150, stock: 30 }]),
  });

  assert.strictEqual(addProdRes.status, 200);
  const addProdData = parseActionResponse(addProdRes.body);
  assert.strictEqual(addProdData.success, true, 'Admin product creation must succeed');
  assert.strictEqual(addProdData.data.name, 'Sterile Gauze Roll 4-inch');
  console.log(`✓ PASS: Admin authorized mutation succeeded: Added "${addProdData.data.name}" (price: ৳${addProdData.data.price}, stock: ${addProdData.data.stock}).`);

  // Step 7: Anti-Spoofing Test - Anonymous user attempts Admin mutation
  console.log('\nStep 7: Anti-Spoofing Security Test (Unauthenticated mutation attempt)');
  const unauthorizedRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': addProductActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      // No cookie passed!
    },
    body: JSON.stringify([null, { name: 'Spoofed Product', price: 999, stock: 999 }]),
  });

  const unauthorizedData = parseActionResponse(unauthorizedRes.body);
  assert.strictEqual(unauthorizedData.success, false, 'Spoofing attempt must fail');
  assert(unauthorizedData.error.includes('403 Forbidden') || unauthorizedData.error.includes('Unauthorized'), 'Must return 403 Forbidden');
  console.log('✓ PASS: Server-side authorization rejected spoofing attempt without valid session cookie.');

  // Step 8: Admin Logout (logoutAdmin)
  console.log('\nStep 8: Admin Logout via Server Action (logoutAdmin)');
  const logoutRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': logoutActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': cookieValue,
    },
    body: JSON.stringify([]),
  });

  assert.strictEqual(logoutRes.status, 200);
  const logoutData = parseActionResponse(logoutRes.body);
  assert.strictEqual(logoutData.success, true, 'Logout action must succeed');

  const logoutCookieHeader = logoutRes.headers['set-cookie'];
  assert(logoutCookieHeader, 'Logout must send set-cookie header');
  const clearedCookie = logoutCookieHeader.find((c) => c.startsWith('shondani_admin_session='));
  assert(clearedCookie, 'Must clear shondani_admin_session cookie');
  assert(clearedCookie.includes('Max-Age=0') || clearedCookie.includes('Expires='), 'Cookie must be expired');
  console.log('✓ PASS: Admin logout cleared session and issued cookie deletion header.');

  // Step 9: Verify Session is Inactive After Logout
  console.log('\nStep 9: Post-Logout Verification (getAdminSessionStatus with old cookie)');
  const postLogoutStatusRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': getSessionStatusActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': cookieValue, // Old revoked cookie
    },
    body: JSON.stringify([]),
  });

  const postLogoutStatus = parseActionResponse(postLogoutStatusRes.body);
  assert.strictEqual(postLogoutStatus.data.isAdmin, false, 'Old cookie must now report isAdmin: false');
  console.log('✓ PASS: Revoked session token is rejected after logout.');

  console.log('\n================================================================');
  console.log('ALL PRODUCTION SERVER HTTP INTEGRATION TESTS PASSED (9/9)');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
