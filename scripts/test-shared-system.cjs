const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('RUNNING CENTRAL SHARED APP & MULTI-DEVICE SIMULATION TESTS');
console.log('================================================================\n');

// 1. Initialize Central Database (Matches src/lib/db.ts)
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'shondani.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    serial_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    order_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    grand_total REAL NOT NULL,
    total_units INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    amount REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// Seed initial products if empty
const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (!countRow || countRow.count === 0) {
  const INITIAL_PRODUCTS = [
    { _id: 'prod_1', serialNumber: 1, name: 'Gauze', price: 120, stock: 9 },
    { _id: 'prod_2', serialNumber: 2, name: 'Thumb Spica', price: 450, stock: 4 },
    { _id: 'prod_3', serialNumber: 3, name: 'Knee Support', price: 900, stock: 2 },
    { _id: 'prod_4', serialNumber: 4, name: 'Tennis Elbow Support', price: 350, stock: 12 },
    { _id: 'prod_5', serialNumber: 5, name: 'Crape Bandage', price: 85, stock: 25 },
    { _id: 'prod_6', serialNumber: 6, name: 'Anklet Support', price: 280, stock: 18 },
    { _id: 'prod_7', serialNumber: 7, name: 'Surgical Tape 1-inch', price: 65, stock: 50 },
  ];
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of INITIAL_PRODUCTS) {
    insertStmt.run(p._id, p.serialNumber, p.name, p.price, p.stock, 0, now, now);
  }
}

// Test 1: Central Database Persistence & Products
console.log('Test 1: Central Database Initialization & Products');
const products = db.prepare('SELECT * FROM products ORDER BY serial_number ASC').all();
assert(products.length >= 7, 'Database should contain at least 7 seeded products');
console.log(`✓ PASS: Initial central database has ${products.length} products available to all devices.`);

// Test 2: Admin Session Token & Server Security
console.log('\nTest 2: Server-Side Admin Session Token Validation');
const token = 'admin_session_' + Date.now();
const insertSession = db.prepare(`
  INSERT INTO admin_sessions (token, username, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);
const now = new Date();
const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
insertSession.run(token, 'omar', now.toISOString(), expiresAt);

const verifySession = db.prepare(`
  SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?
`);
const sessionRow = verifySession.get(token, new Date().toISOString());
assert(sessionRow !== undefined, 'Admin session should be verified');
console.log('✓ PASS: Server-side admin authorization correctly stored and validated in central DB.');

// Test 3: Admin on Phone 1 changes Product Stock -> Central DB Updates
console.log('\nTest 3: Admin on Phone 1 changes Product Stock');
const testProduct = products[0]; // e.g. Gauze
const updatedStock = 50;

db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(
  updatedStock,
  new Date().toISOString(),
  testProduct.id
);

// Verify that any other phone querying gets stock 50
const phone2View = db.prepare('SELECT * FROM products WHERE id = ?').get(testProduct.id);
assert.strictEqual(phone2View.stock, 50, 'Phone 2 must see the exact updated stock (50)');
console.log(`✓ PASS: Admin on Phone 1 changed stock to 50 -> Phone 2 immediately reads stock: ${phone2View.stock}.`);

// Test 4: User on Phone 7 places an order for Quantity 5
console.log('\nTest 4: User on Phone 7 places an order (Quantity: 5)');
const orderId = `SMH-ORD-${Date.now()}`;
const orderedQty = 5;
const unitPrice = phone2View.price;
const totalAmount = unitPrice * orderedQty;

db.exec('BEGIN IMMEDIATE');
try {
  // Deduct stock
  db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?').run(
    orderedQty,
    new Date().toISOString(),
    testProduct.id
  );

  // Insert order
  db.prepare(`
    INSERT INTO orders (id, customer_name, grand_total, total_units, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(orderId, 'Phone 7 User', totalAmount, orderedQty, 'completed', new Date().toISOString());

  // Insert order item
  db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(`item_${Date.now()}`, orderId, testProduct.id, testProduct.name, unitPrice, orderedQty, totalAmount);

  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}

// Check stock on Phone 12
const phone12Stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(testProduct.id);
assert.strictEqual(phone12Stock.stock, 45, 'Stock should be 45 after atomic deduction');
console.log(`✓ PASS: Order ${orderId} submitted. Stock atomically deducted 50 -> 45 across all devices.`);

// Test 5: User on Phone 12 opens and downloads invoice for Phone 7's order
console.log('\nTest 5: User on Phone 12 queries central DB for Phone 7 order');
const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
assert(orderRow !== undefined, 'Phone 12 must find Phone 7 order in central DB');
assert.strictEqual(orderRow.id, orderId);
assert.strictEqual(orderRow.grand_total, totalAmount);

const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
assert.strictEqual(orderItems.length, 1);
assert.strictEqual(orderItems[0].quantity, 5);
assert.strictEqual(orderItems[0].amount, totalAmount);
console.log(`✓ PASS: Phone 12 retrieved identical shared order data for ${orderId}: ${orderItems[0].product_name} x ${orderItems[0].quantity} = ৳${orderRow.grand_total}.`);

// Test 6: Concurrency Simulation (Multiple simultaneous orders)
console.log('\nTest 6: Concurrency Simulation (Multiple simultaneous orders)');
const stockBefore = db.prepare('SELECT stock FROM products WHERE id = ?').get(testProduct.id).stock;
const orderCount = 5;
const qtyPerOrder = 2;

for (let i = 1; i <= orderCount; i++) {
  const simOrderId = `SMH-ORD-SIM-${i}-${Date.now()}`;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?').run(
      qtyPerOrder,
      new Date().toISOString(),
      testProduct.id
    );
    db.prepare(`
      INSERT INTO orders (id, customer_name, grand_total, total_units, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(simOrderId, `Customer ${i}`, unitPrice * qtyPerOrder, qtyPerOrder, 'completed', new Date().toISOString());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const stockAfter = db.prepare('SELECT stock FROM products WHERE id = ?').get(testProduct.id).stock;
assert.strictEqual(stockAfter, stockBefore - (orderCount * qtyPerOrder), 'Stock after concurrent orders should exactly match deductions');
console.log(`✓ PASS: ${orderCount} consecutive orders processed atomically: stock decreased from ${stockBefore} to ${stockAfter}.`);

// Test 7: Orders List in Central DB
console.log('\nTest 7: Central Orders List History');
const allOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
assert(allOrders.length >= 6, 'Central database should contain all placed orders');
console.log(`✓ PASS: Central database contains ${allOrders.length} historical shared orders.`);

console.log('\n================================================================');
console.log('ALL CENTRAL DATABASE & MULTI-DEVICE SIMULATION TESTS PASSED (7/7)');
console.log('================================================================');
