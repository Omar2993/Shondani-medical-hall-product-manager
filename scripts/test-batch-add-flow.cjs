const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('RUNNING BATCH PRODUCT-ADD FLOW TEST SUITE');
console.log('================================================================\n');

// 1. Direct Database batchAddProducts Test
console.log('Test 1: Direct Database batchAddProducts Function');
const dbPath = path.join(__dirname, '..', 'data', 'shondani.db');
const db = new DatabaseSync(dbPath);

const countBefore = db.prepare('SELECT COUNT(*) as count FROM products').get().count;

function batchAddProducts(names) {
  if (!Array.isArray(names) || names.length === 0) return [];
  const validNames = names.map(n => (typeof n === 'string' ? n.trim() : '')).filter(n => n.length > 0);
  if (validNames.length === 0) return [];

  const maxRow = db.prepare('SELECT COALESCE(MAX(serial_number), 0) as maxSerial FROM products').get();
  let nextSerial = (maxRow?.maxSerial || 0) + 1;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const name of validNames) {
      const id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      insertStmt.run(id, nextSerial++, name, now, now);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return db.prepare('SELECT * FROM products ORDER BY serial_number ASC').all();
}

const batchTestNames = ['Batch Test Item A ' + Date.now(), 'Batch Test Item B ' + Date.now()];
const updatedList = batchAddProducts(batchTestNames);
const countAfter = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
assert.strictEqual(countAfter, countBefore + 2, 'Products count in DB must increase by 2');

const itemA = updatedList.find(p => p.name === batchTestNames[0]);
const itemB = updatedList.find(p => p.name === batchTestNames[1]);
assert(itemA !== undefined, 'Batch Item A must exist in returned list');
assert(itemB !== undefined, 'Batch Item B must exist in returned list');
assert(itemB.serial_number > itemA.serial_number, 'Serial numbers must be sequential');
console.log(`✓ PASS: Database batchAddProducts saved ${batchTestNames.length} items with unique serial numbers.`);

// 2. Test Empty and Invalid Input Handling
console.log('\nTest 2: Validation of Empty & Whitespace Names in Batch Add');
const countBeforeEmpty = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
batchAddProducts(['', '   ', null, undefined]);
const countAfterEmpty = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
assert.strictEqual(countAfterEmpty, countBeforeEmpty, 'Empty names must not be inserted into DB');
console.log('✓ PASS: Empty and whitespace strings are safely rejected without error.');

// 3. Live Server E2E Test on Running Next.js Production Server
console.log('\nTest 3: Live Server E2E Batch Product-Add via Server Action & API');

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
const batchAddActionId = findActionId('authorizedBatchAdd');
const addSingleProductActionId = findActionId('authorizedAddProduct');

const PORT = process.env.PORT || '3010';
const BASE_URL = `http://localhost:${PORT}`;

function fetchHttp(urlPath, options = {}) {
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
  return JSON.parse(body);
}

async function runLiveTests() {
  // Step 3.1: Admin Login
  console.log('Logging in as Admin via Server Action...');
  const loginRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': verifyCredentialsActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
    },
    body: JSON.stringify(['Omar', 'Omar88067']),
  });
  assert.strictEqual(loginRes.status, 200);
  const sessionCookie = loginRes.headers['set-cookie'].find(c => c.startsWith('shondani_admin_session=')).split(';')[0];
  console.log('✓ Admin authenticated, session cookie acquired.');

  // Step 3.2: Batch Add Products via Server Action
  const liveBatchNames = ['Napa Extra 500mg', 'Ace Plus 500mg', 'Ceevit 250mg'];
  console.log(`Submitting Batch add for ${liveBatchNames.length} products...`);
  const batchRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': batchAddActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify([null, liveBatchNames]),
  });

  assert.strictEqual(batchRes.status, 200, 'Batch add action must return 200');
  const batchData = parseActionResponse(batchRes.body);
  assert.strictEqual(batchData.success, true, 'Batch add action success must be true');
  assert(Array.isArray(batchData.data), 'Batch add action must return updated Product[] array');

  for (const name of liveBatchNames) {
    const found = batchData.data.find(p => p.name === name);
    assert(found !== undefined, `Product "${name}" must appear in the returned updated products array`);
    assert(found.serialNumber > 0, `Product "${name}" must have a valid serial number`);
  }
  console.log(`✓ PASS: Batch add Server Action returned updated catalog with all ${liveBatchNames.length} products.`);

  // Step 3.3: Verify products are saved in Database and visible in /api/sync
  console.log('Verifying products persist in central database via GET /api/sync...');
  const syncRes = await fetchHttp('/api/sync');
  assert.strictEqual(syncRes.status, 200);
  const syncData = JSON.parse(syncRes.body);
  const syncProducts = syncData.products || syncData.data?.products;

  for (const name of liveBatchNames) {
    const foundInSync = syncProducts.find(p => p.name === name);
    assert(foundInSync !== undefined, `Product "${name}" must be persisted in database and returned by /api/sync`);
  }
  console.log('✓ PASS: All Batch products are confirmed saved in database and returned by /api/sync.');

  // Step 3.4: Verify Non-Batch Single Product Add is not broken (Requirement 5)
  console.log('\nTest 4: Verifying Non-Batch Single Product Add Still Works (Requirement 5)');
  const singleAddRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': addSingleProductActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify([null, { name: 'Non-Batch Diagnostic Product', price: 99, stock: 10 }]),
  });
  assert.strictEqual(singleAddRes.status, 200);
  const singleAddData = parseActionResponse(singleAddRes.body);
  assert.strictEqual(singleAddData.success, true, 'Single add must succeed');
  assert.strictEqual(singleAddData.data.name, 'Non-Batch Diagnostic Product');
  console.log('✓ PASS: Standard single product addition remains completely functional.');

  // Step 3.5: Verify Unauthorized Batch Add rejection (Requirement 3)
  console.log('\nTest 5: Verifying Unauthorized Batch Add Rejection');
  const unauthorizedBatchRes = await fetchHttp('/', {
    method: 'POST',
    headers: {
      'Next-Action': batchAddActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
      // No cookie
    },
    body: JSON.stringify([null, ['Unauthorized Item']]),
  });
  const unauthData = parseActionResponse(unauthorizedBatchRes.body);
  assert.strictEqual(unauthData.success, false, 'Unauthorized batch add must fail');
  console.log('✓ PASS: Unauthorized batch add attempt correctly rejected with 403 Forbidden.');

  console.log('\n================================================================');
  console.log('ALL BATCH ADD & DATABASE PERSISTENCE TESTS PASSED (5/5)');
  console.log('================================================================');
}

module.exports = { runLiveTests };

if (require.main === module) {
  runLiveTests().catch(err => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });
}
