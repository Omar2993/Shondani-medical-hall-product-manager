import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Product, InvoiceMeta, CustomerOrder } from '@/types/product';
import { createAdminSession, verifyAdminSession, revokeAdminSession } from './auth';

export { createAdminSession, verifyAdminSession, revokeAdminSession };

// Initial master catalog for Shondani Medical Hall
const INITIAL_PRODUCTS: Array<Omit<Product, 'createdAt' | 'updatedAt'>> = [
  { _id: 'prod_1', serialNumber: 1, name: 'Gauze', price: 120, stock: 9 },
  { _id: 'prod_2', serialNumber: 2, name: 'Thumb Spica', price: 450, stock: 4 },
  { _id: 'prod_3', serialNumber: 3, name: 'Knee Support', price: 900, stock: 2 },
  { _id: 'prod_4', serialNumber: 4, name: 'Tennis Elbow Support', price: 350, stock: 12 },
  { _id: 'prod_5', serialNumber: 5, name: 'Crape Bandage', price: 85, stock: 25 },
  { _id: 'prod_6', serialNumber: 6, name: 'Anklet Support', price: 280, stock: 18 },
  { _id: 'prod_7', serialNumber: 7, name: 'Surgical Tape 1-inch', price: 65, stock: 50 },
];

const globalForDb = globalThis as unknown as {
  _shondaniDb?: DatabaseSync;
};

/**
 * Resolves a reliable, writable database path across local dev and deployed serverless environments.
 * On serverless platforms (such as Vercel/AWS Lambda), process.cwd() is read-only, so this safely falls
 * back to os.tmpdir() and seeds it from the bundled database if present.
 */
function resolveDatabasePath(): string {
  // 1. Explicit environment variable
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    const customPath = process.env.DATABASE_PATH.trim();
    try {
      const parentDir = path.dirname(customPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      return customPath;
    } catch (err) {
      console.warn(`DATABASE_PATH (${customPath}) is not writable:`, err);
    }
  }

  // 2. Try process.cwd()/data (standard for local dev and persistent server environments)
  const localDataDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const probeFile = path.join(localDataDir, `.probe_${Date.now()}`);
    fs.writeFileSync(probeFile, 'ok');
    fs.unlinkSync(probeFile);
    return path.join(localDataDir, 'shondani.db');
  } catch {
    // Local directory is read-only (e.g. Vercel serverless /var/task)
  }

  // 3. Fallback to os.tmpdir() (guaranteed writable in serverless environments like AWS Lambda & Vercel)
  try {
    const tmpDataDir = path.join(os.tmpdir(), 'shondani-data');
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    const targetDbPath = path.join(tmpDataDir, 'shondani.db');

    // If a bundled database exists in local data/ directory, copy it into /tmp
    const bundledDbPath = path.join(process.cwd(), 'data', 'shondani.db');
    if (fs.existsSync(bundledDbPath) && !fs.existsSync(targetDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, targetDbPath);
      } catch {
        // ignore copy errors
      }
    }
    return targetDbPath;
  } catch (err) {
    console.warn('Could not initialize SQLite database in tmp directory:', err);
    return ':memory:';
  }
}

export function getRawDb(): DatabaseSync | null {
  try {
    return getDb();
  } catch {
    return null;
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb._shondaniDb) {
    return globalForDb._shondaniDb;
  }

  const dbPath = resolveDatabasePath();
  const db = new DatabaseSync(dbPath);

  if (dbPath !== ':memory:') {
    try {
      // Enable WAL mode for high concurrency if supported by filesystem
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // Ignore if filesystem doesn't support WAL
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
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

    CREATE TABLE IF NOT EXISTS revoked_sessions (
      token TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL
    );
  `);

  // Seed initial products if table is empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const countRow = countStmt.get() as { count: number } | undefined;

  if (!countRow || countRow.count === 0) {
    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of INITIAL_PRODUCTS) {
      insertStmt.run(p._id, p.serialNumber, p.name, p.price, p.stock, 0, now, now);
    }
  }

  // Seed default metadata if empty
  const metaCountStmt = db.prepare('SELECT COUNT(*) as count FROM app_meta');
  const metaCountRow = metaCountStmt.get() as { count: number } | undefined;
  if (!metaCountRow || metaCountRow.count === 0) {
    const defaultMeta: InvoiceMeta = {
      shopName: 'Shondani Medical Hall',
      invoiceTitle: 'INVENTORY / INVOICE',
      invoiceNumber: 'SMH-2025-001',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      currency: '৳',
      address: 'Shondani Market, Main Road',
      phone: '+880 1700-000000',
    };

    const insertMetaStmt = db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultMeta)) {
      insertMetaStmt.run(key, String(value));
    }
  }

  globalForDb._shondaniDb = db;
  return db;
}

// Map database row to Product object
function rowToProduct(row: Record<string, unknown>): Product {
  return {
    _id: String(row.id),
    serialNumber: Number(row.serial_number),
    name: String(row.name),
    price: Number(row.price),
    stock: Number(row.stock),
    orderQuantity: Number(row.order_quantity || 0),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

/**
 * Get all products ordered strictly by serial number
 */
export function getAllProducts(): Product[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY serial_number ASC').all();
  return rows.map(rowToProduct);
}

/**
 * Get single product by ID
 */
export function getProductById(id: string): Product | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? rowToProduct(row) : null;
}

/**
 * Create a new product at the end of the catalog
 */
export function createProduct(name: string, price: number = 0, stock: number = 0): Product {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  const nextSerial = (countRow?.count || 0) + 1;
  const id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, nextSerial, name.trim(), Math.max(0, price), Math.max(0, stock), now, now);

  return {
    _id: id,
    serialNumber: nextSerial,
    name: name.trim(),
    price: Math.max(0, price),
    stock: Math.max(0, stock),
    orderQuantity: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update product fields
 */
export function updateProduct(
  id: string,
  updates: Partial<Pick<Product, 'name' | 'price' | 'stock' | 'orderQuantity'>>
): Product | null {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) return null;

  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const price = updates.price !== undefined ? Math.max(0, updates.price) : existing.price;
  const stock = updates.stock !== undefined ? Math.max(0, updates.stock) : existing.stock;
  const orderQuantity = updates.orderQuantity !== undefined ? Math.max(0, updates.orderQuantity) : (existing.orderQuantity || 0);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products
    SET name = ?, price = ?, stock = ?, order_quantity = ?, updated_at = ?
    WHERE id = ?
  `).run(name, price, stock, orderQuantity, now, id);

  return {
    ...existing,
    name,
    price,
    stock,
    orderQuantity,
    updatedAt: now,
  };
}

/**
 * Delete a product and automatically renumber all subsequent products
 */
export function deleteProduct(id: string): Product[] {
  const db = getDb();
  const target = getProductById(id);
  if (!target) return getAllProducts();

  db.prepare('DELETE FROM products WHERE id = ?').run(id);

  // Renumber remaining products
  const remaining = db.prepare('SELECT id FROM products ORDER BY serial_number ASC').all() as Array<{ id: string }>;
  const updateSerialStmt = db.prepare('UPDATE products SET serial_number = ? WHERE id = ?');
  for (let i = 0; i < remaining.length; i++) {
    updateSerialStmt.run(i + 1, remaining[i].id);
  }

  return getAllProducts();
}

/**
 * Insert a product at a specific serial position
 */
export function insertProductAtSerial(
  targetSerial: number,
  name: string,
  price: number = 0,
  stock: number = 0
): Product[] {
  const db = getDb();
  const all = getAllProducts();
  const safeSerial = Math.max(1, Math.min(targetSerial, all.length + 1));
  const newId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  // Shift items down from safeSerial onwards
  db.prepare('UPDATE products SET serial_number = serial_number + 1 WHERE serial_number >= ?').run(safeSerial);

  // Insert the new item
  db.prepare(`
    INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(newId, safeSerial, name.trim(), Math.max(0, price), Math.max(0, stock), now, now);

  return getAllProducts();
}

/**
 * Batch add multiple products
 */
export function batchAddProducts(names: string[]): Product[] {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  let nextSerial = (countRow?.count || 0) + 1;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO products (id, serial_number, name, price, stock, order_quantity, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, ?, ?)
  `);

  for (const name of names) {
    if (name && name.trim()) {
      const id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      insertStmt.run(id, nextSerial++, name.trim(), now, now);
    }
  }

  return getAllProducts();
}

/**
 * Move product up or down
 */
export function moveProduct(serialNumber: number, direction: 'up' | 'down'): Product[] {
  const db = getDb();
  const all = getAllProducts();
  const currentIndex = all.findIndex(p => p.serialNumber === serialNumber);
  if (currentIndex === -1) return all;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= all.length) return all;

  const currentItem = all[currentIndex];
  const targetItem = all[targetIndex];

  // Swap serial numbers
  db.prepare('UPDATE products SET serial_number = ? WHERE id = ?').run(targetItem.serialNumber, currentItem._id);
  db.prepare('UPDATE products SET serial_number = ? WHERE id = ?').run(currentItem.serialNumber, targetItem._id);

  return getAllProducts();
}

/**
 * Get App Metadata
 */
export function getAppMeta(): InvoiceMeta {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM app_meta').all() as Array<{ key: string; value: string }>;
  const metaObj: Record<string, string> = {};
  for (const r of rows) {
    metaObj[r.key] = r.value;
  }

  return {
    shopName: metaObj.shopName || 'Shondani Medical Hall',
    invoiceTitle: metaObj.invoiceTitle || 'INVENTORY / INVOICE',
    invoiceNumber: metaObj.invoiceNumber || 'SMH-2025-001',
    date: metaObj.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currency: metaObj.currency || '৳',
    address: metaObj.address || 'Shondani Market, Main Road',
    phone: metaObj.phone || '+880 1700-000000',
  };
}

/**
 * Update App Metadata
 */
export function updateAppMeta(updates: Partial<InvoiceMeta>): InvoiceMeta {
  const db = getDb();
  const upsertStmt = db.prepare(`
    INSERT INTO app_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      upsertStmt.run(k, String(v));
    }
  }

  return getAppMeta();
}

/**
 * Submit an order centrally with atomic stock deduction and transaction guarantee
 */
export function submitOrder(
  customerName: string,
  items: Array<{ productId: string; productName: string; price: number; quantity: number }>
): { order: CustomerOrder; updatedProducts: Product[] } {
  const db = getDb();

  const validItems = items.filter(it => it.quantity > 0);
  if (validItems.length === 0) {
    throw new Error('Cannot submit order: No items with quantity > 0');
  }

  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();
  let grandTotal = 0;
  let totalUnits = 0;

  const orderItemsFormatted = validItems.map(it => {
    const itemAmount = Math.max(0, it.price) * Math.max(0, it.quantity);
    grandTotal += itemAmount;
    totalUnits += it.quantity;
    return {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      productId: it.productId,
      productName: it.productName,
      price: it.price,
      quantity: it.quantity,
      amount: itemAmount,
    };
  });

  // Execute order creation and stock deduction atomically
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Insert order
    db.prepare(`
      INSERT INTO orders (id, customer_name, grand_total, total_units, status, created_at)
      VALUES (?, ?, ?, ?, 'completed', ?)
    `).run(orderId, customerName || 'Customer User', grandTotal, totalUnits, now);

    // 2. Insert order items
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // 3. Atomically decrement warehouse stock
    const decrementStockStmt = db.prepare(`
      UPDATE products
      SET stock = MAX(0, stock - ?), updated_at = ?
      WHERE id = ?
    `);

    for (const item of orderItemsFormatted) {
      insertItemStmt.run(item.id, orderId, item.productId, item.productName, item.price, item.quantity, item.amount);
      decrementStockStmt.run(item.quantity, now, item.productId);
    }

    // 4. Update last_order_id in app_meta
    db.prepare(`
      INSERT INTO app_meta (key, value) VALUES ('latest_order_id', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(orderId);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  const createdOrder: CustomerOrder = {
    orderId,
    customerName: customerName || 'Customer User',
    date: now,
    items: orderItemsFormatted.map(it => ({
      productId: it.productId,
      productName: it.productName,
      price: it.price,
      orderedQuantity: it.quantity,
      amount: it.amount,
    })),
    grandTotal,
  };

  return {
    order: createdOrder,
    updatedProducts: getAllProducts(),
  };
}

/**
 * Get all placed orders
 */
export function getAllOrders(limit: number = 50): CustomerOrder[] {
  const db = getDb();
  const orderRows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit) as Array<{
    id: string;
    customer_name: string;
    grand_total: number;
    total_units: number;
    status: string;
    created_at: string;
  }>;

  const itemRows = db.prepare('SELECT * FROM order_items').all() as Array<{
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    amount: number;
  }>;

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, []);
    }
    itemsByOrder.get(item.order_id)!.push(item);
  }

  return orderRows.map(o => ({
    orderId: o.id,
    customerName: o.customer_name,
    date: o.created_at,
    items: (itemsByOrder.get(o.id) || []).map(it => ({
      productId: it.product_id,
      productName: it.product_name,
      price: it.price,
      orderedQuantity: it.quantity,
      amount: it.amount,
    })),
    grandTotal: o.grand_total,
  }));
}

/**
 * Get a specific order by ID
 */
export function getOrderById(orderId: string): CustomerOrder | null {
  const db = getDb();
  const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as {
    id: string;
    customer_name: string;
    grand_total: number;
    created_at: string;
  } | undefined;

  if (!orderRow) return null;

  const itemRows = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as Array<{
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    amount: number;
  }>;

  return {
    orderId: orderRow.id,
    customerName: orderRow.customer_name,
    date: orderRow.created_at,
    items: itemRows.map(it => ({
      productId: it.product_id,
      productName: it.product_name,
      price: it.price,
      orderedQuantity: it.quantity,
      amount: it.amount,
    })),
    grandTotal: orderRow.grand_total,
  };
}
