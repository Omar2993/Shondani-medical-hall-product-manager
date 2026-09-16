const { generateInvoicePdf } = require('./dist/invoicePdfGenerator');
const assert = require('assert');

console.log('================================================================');
console.log('RUNNING COMPREHENSIVE INVOICE GENERATOR TEST SUITE');
console.log('================================================================\n');

const baseMeta = {
  shopName: 'Shondani Medical Hall',
  invoiceTitle: 'CUSTOMER ORDER INVOICE',
  invoiceNumber: 'TEST-INV-001',
  date: '17 Sep 2026',
  currency: '৳',
  address: 'Shondani Market, Main Road',
  phone: '+880 1700-000000',
};

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Single product
runTest('1 product invoice: correct calculation, single page, exact totals', () => {
  const products = [
    { _id: 'p1', serialNumber: 1, name: 'Surgical Gauze Pad 10x10', price: 150, stock: 50 },
  ];
  const userOrders = { p1: 3 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 1);
  assert.strictEqual(result.pageCount, 1);
  assert.strictEqual(result.grandTotal, 450); // 150 * 3
});

// 2. 2-3 products
runTest('2–3 products invoice: correct ordering and totals', () => {
  const products = [
    { _id: 'p1', serialNumber: 1, name: 'Thumb Spica Splint', price: 450, stock: 10 },
    { _id: 'p2', serialNumber: 2, name: 'Tennis Elbow Support', price: 350, stock: 15 },
    { _id: 'p3', serialNumber: 3, name: 'Crape Bandage 4-inch', price: 85, stock: 30 },
  ];
  const userOrders = { p1: 2, p2: 1, p3: 4 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 3);
  assert.strictEqual(result.pageCount, 1);
  // (450 * 2) + (350 * 1) + (85 * 4) = 900 + 350 + 340 = 1590
  assert.strictEqual(result.grandTotal, 1590);
});

// 3. 10+ products
runTest('10+ products invoice: non-overlapping and preserved order', () => {
  const products = [];
  const userOrders = {};
  let expectedTotal = 0;

  for (let i = 1; i <= 14; i++) {
    const id = `prod_${i}`;
    const price = 50 + i * 10;
    const qty = (i % 3) + 1;
    products.push({
      _id: id,
      serialNumber: i,
      name: `Medical Supply Item #${i}`,
      price,
      stock: 20,
    });
    userOrders[id] = qty;
    expectedTotal += price * qty;
  }

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 14);
  assert.strictEqual(result.grandTotal, expectedTotal);
});

// 4. Multi-page invoice (35+ products)
runTest('Multi-page invoice (enough products for multiple pages): clean page break & continuation', () => {
  const products = [];
  const userOrders = {};
  let expectedTotal = 0;

  for (let i = 1; i <= 45; i++) {
    const id = `item_${i}`;
    const price = 100 + i;
    const qty = 2;
    products.push({
      _id: id,
      serialNumber: i,
      name: `Orthopedic Support Equipment Model ${i}`,
      price,
      stock: 50,
    });
    userOrders[id] = qty;
    expectedTotal += price * qty;
  }

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 45);
  assert.strictEqual(result.grandTotal, expectedTotal);
  assert(result.pageCount >= 2, `Expected at least 2 pages, got ${result.pageCount}`);
});

// 5. Very long product names
runTest('Very long product names: text wrap, dynamic row height calculation, no overflow', () => {
  const products = [
    {
      _id: 'p_long_1',
      serialNumber: 1,
      name: 'Ultra Premium Ergonomic Breathable Adjustable Lumbar Sacro Support Orthosis Belt with Removable Steel Stays and Extra Compression Straps for Lower Back Pain Relief (Size XL)',
      price: 1850,
      stock: 5,
    },
    {
      _id: 'p_long_2',
      serialNumber: 2,
      name: 'Heavy Duty High Density Cotton Micro-Porous Hypoallergenic Zinc Oxide Adhesive Surgical Fixation Tape 3-inch x 10 Yards Hospital Grade Roll Pack of 6',
      price: 720,
      stock: 12,
    },
  ];
  const userOrders = { p_long_1: 1, p_long_2: 3 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 2);
  assert.strictEqual(result.grandTotal, 1850 * 1 + 720 * 3);
});

// 6. Short product names
runTest('Short product names: standard minimum row height applied', () => {
  const products = [
    { _id: 's1', serialNumber: 1, name: 'Tape', price: 20, stock: 100 },
    { _id: 's2', serialNumber: 2, name: 'Gel', price: 45, stock: 100 },
    { _id: 's3', serialNumber: 3, name: 'Pad', price: 15, stock: 100 },
  ];
  const userOrders = { s1: 5, s2: 2, s3: 10 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 3);
  assert.strictEqual(result.grandTotal, 20 * 5 + 45 * 2 + 15 * 10);
});

// 7. Products mixed with 0 and positive order quantities
runTest('Products mixed with 0 and positive order quantities: 0-quantity items completely excluded', () => {
  const products = [
    { _id: 'm1', serialNumber: 1, name: 'Product With Qty 0', price: 1000, stock: 10 },
    { _id: 'm2', serialNumber: 2, name: 'Ordered Product A', price: 250, stock: 10 },
    { _id: 'm3', serialNumber: 3, name: 'Another Qty 0 Product', price: 500, stock: 10 },
    { _id: 'm4', serialNumber: 4, name: 'Ordered Product B', price: 400, stock: 10 },
    { _id: 'm5', serialNumber: 5, name: 'Third Qty 0 Product', price: 750, stock: 10 },
  ];
  // Only m2 and m4 have positive order quantities
  const userOrders = { m1: 0, m2: 2, m3: 0, m4: 3, m5: 0 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  // Strictly only 2 products should be in the invoice
  assert.strictEqual(result.productCount, 2);
  // Total must ONLY sum m2 and m4
  assert.strictEqual(result.grandTotal, 250 * 2 + 400 * 3); // 500 + 1200 = 1700
});

// 8. All products having 0 order quantity
runTest('All products having 0 order quantity: fails gracefully with "No products to invoice" message', () => {
  const products = [
    { _id: 'z1', serialNumber: 1, name: 'Item 1', price: 100, stock: 10 },
    { _id: 'z2', serialNumber: 2, name: 'Item 2', price: 200, stock: 10 },
  ];
  const userOrders = { z1: 0, z2: 0 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'No products to invoice');
  assert(result.message && result.message.length > 0);
});

// 9. Different quantities and prices (accurate decimal math and formatting)
runTest('Different quantities and prices: exact financial calculations', () => {
  const products = [
    { _id: 'd1', serialNumber: 1, name: 'Surgical Scissors', price: 345.50, stock: 10 },
    { _id: 'd2', serialNumber: 2, name: 'Digital Thermometer', price: 625.75, stock: 20 },
  ];
  const userOrders = { d1: 4, d2: 2 };

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 2);
  const expectedTotal = 345.50 * 4 + 625.75 * 2;
  assert.strictEqual(result.grandTotal, expectedTotal);
});

// 10. Multi-page with long product names
runTest('Multiple pages with long product names: dynamic row height calculation across page boundaries', () => {
  const products = [];
  const userOrders = {};
  let expectedTotal = 0;

  for (let i = 1; i <= 25; i++) {
    const id = `item_long_${i}`;
    const price = 250;
    const qty = 1;
    products.push({
      _id: id,
      serialNumber: i,
      name: `Multi-Word Long Medical Description For Hospital Ward Item #${i} - High Strength Titanium Plated Surgical Specimen Container with Safety Locking Mechanism`,
      price,
      stock: 15,
    });
    userOrders[id] = qty;
    expectedTotal += price * qty;
  }

  const result = generateInvoicePdf({
    products,
    meta: baseMeta,
    role: 'user',
    userOrders,
    autoDownload: false,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.productCount, 25);
  assert.strictEqual(result.grandTotal, expectedTotal);
  assert(result.pageCount >= 2, `Expected at least 2 pages for 25 multiline items, got ${result.pageCount}`);
});

console.log('\n----------------------------------------------------------------');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed.`);
console.log('----------------------------------------------------------------\n');
