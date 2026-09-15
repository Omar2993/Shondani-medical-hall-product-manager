'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Product, 
  FilterType, 
  SaveStatus, 
  InvoiceMeta, 
  UserRole,
  AdminInventoryStats,
  UserOrderStats
} from '@/types/product';
import { InventoryHeader } from './InventoryHeader';
import { InventorySummary } from './InventorySummary';
import { SearchAndFilterBar } from './SearchAndFilterBar';
import { InventoryRow } from './InventoryRow';
import { MobileInventoryCard } from './MobileInventoryCard';
import { QuickBatchAddModal } from './QuickBatchAddModal';
import { InsertAtSerialModal } from './InsertAtSerialModal';
import { ConfirmDialog } from './ConfirmDialog';
import { OrderSuccessModal } from './OrderSuccessModal';
import { PrintableInvoice } from './PrintableInvoice';
import { PlusIcon, PackageIcon, ShoppingCartIcon } from './icons';
import { 
  authorizedAddProduct, 
  authorizedUpdateProduct, 
  authorizedDeleteProduct, 
  authorizedSubmitOrder 
} from '@/actions/authorizedProductActions';

// Initial master catalog as specified in instructions
const INITIAL_PRODUCTS: Product[] = [
  {
    _id: 'prod_1',
    serialNumber: 1,
    name: 'Gauze',
    price: 120,
    stock: 9,
  },
  {
    _id: 'prod_2',
    serialNumber: 2,
    name: 'Thumb Spica',
    price: 450,
    stock: 4,
  },
  {
    _id: 'prod_3',
    serialNumber: 3,
    name: 'Knee Support',
    price: 900,
    stock: 2,
  },
  {
    _id: 'prod_4',
    serialNumber: 4,
    name: 'Tennis Elbow Support',
    price: 350,
    stock: 12,
  },
  {
    _id: 'prod_5',
    serialNumber: 5,
    name: 'Crape Bandage',
    price: 85,
    stock: 25,
  },
];

const LOCAL_STORAGE_KEY = 'inventory_catalog_data_v2';
const LOCAL_STORAGE_ORDERS_KEY = 'inventory_user_orders_v2';
const LOCAL_STORAGE_META_KEY = 'inventory_sheet_meta_v2';
const LOCAL_STORAGE_ROLE_KEY = 'inventory_user_role_v2';

export function InventorySheet() {
  // 1. Role State: Default to 'admin' so the user can immediately test admin features, or switch to 'user'
  const [role, setRole] = useState<UserRole>('admin');

  // 2. Master Product Catalog (Managed exclusively by Admin)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);

  // 3. User Order Quantities (Completely separate from Admin stock)
  // Mapping: { [productId]: orderedQuantity }
  const [userOrders, setUserOrders] = useState<Record<string, number>>({
    prod_1: 10, // Gauze: 10 ordered
    prod_2: 5,  // Thumb Spica: 5 ordered
    prod_3: 6,  // Knee Support: 6 ordered
  });

  // 4. UI Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // 5. Invoice Metadata
  const [meta, setMeta] = useState<InvoiceMeta>({
    shopName: 'M/S MediCare Surgical & Health Store',
    invoiceTitle: 'INVENTORY / INVOICE',
    invoiceNumber: 'INV-2025-001',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currency: '৳',
  });

  // 6. Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    items: Array<{ name: string; price: number; quantity: number; amount: number }>;
    grandTotal: number;
  } | null>(null);

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to renumber serials sequentially 1 to N
  const renumberProducts = (list: Product[]): Product[] => {
    return list.map((item, idx) => ({
      ...item,
      serialNumber: idx + 1,
    }));
  };

  // Load saved state on client mount
  useEffect(() => {
    try {
      const storedCatalog = localStorage.getItem(LOCAL_STORAGE_KEY);
      const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      const storedMeta = localStorage.getItem(LOCAL_STORAGE_META_KEY);
      const storedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;

      if (storedCatalog) {
        const parsed = JSON.parse(storedCatalog);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(renumberProducts(parsed));
        }
      }

      if (storedOrders) {
        setUserOrders(JSON.parse(storedOrders));
      }

      if (storedMeta) {
        setMeta(JSON.parse(storedMeta));
      }

      if (storedRole === 'admin' || storedRole === 'user') {
        setRole(storedRole);
      }
    } catch {
      console.warn('Could not read from localStorage');
    }
  }, []);

  // Safe Debounced Auto-Save for Admin Changes
  const triggerAutoSave = useCallback((newProducts: Product[], newMeta?: InvoiceMeta) => {
    setSaveStatus('unsaved');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProducts));
        if (newMeta) {
          localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(newMeta));
        }
        setTimeout(() => {
          setSaveStatus('saved');
        }, 300);
      } catch (err) {
        console.error('Auto-save error:', err);
        setSaveStatus('error');
      }
    }, 1200);
  }, []);

  // Persist User Orders
  const updateUserOrderQty = (productId: string, newQty: number) => {
    setUserOrders(prev => {
      const updated = { ...prev, [productId]: Math.max(0, newQty) };
      try {
        localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Clear all user order quantities
  const handleClearOrder = () => {
    setUserOrders({});
    try {
      localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
    } catch {
      // ignore
    }
  };

  // Role toggle handler
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    try {
      localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, newRole);
    } catch {
      // ignore
    }
  };

  // Manual Save (Admin)
  const handleManualSave = () => {
    if (role !== 'admin') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('saving');
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
      localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(meta));
      setTimeout(() => {
        setSaveStatus('saved');
      }, 350);
    } catch (err) {
      console.error('Manual save failed', err);
      setSaveStatus('error');
    }
  };

  // Update Product fields (Admin only, server-authorized)
  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    if (role !== 'admin') {
      alert('Permission denied: Only Administrators can edit product information.');
      return;
    }

    // Call server action to verify authorization
    const serverResp = await authorizedUpdateProduct(role, id, {
      name: updates.name,
      price: updates.price,
      stock: updates.stock,
    });

    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
      return;
    }

    setProducts((prev) => {
      const next = prev.map((p) => (p._id === id ? { ...p, ...updates } : p));
      triggerAutoSave(next);
      return next;
    });
  };

  // Update Invoice Meta (Admin only)
  const handleMetaChange = (updatedMeta: Partial<InvoiceMeta>) => {
    if (role !== 'admin') return;
    setMeta((prev) => {
      const next = { ...prev, ...updatedMeta };
      triggerAutoSave(products, next);
      return next;
    });
  };

  // Add a single blank product at the end (Admin only)
  const handleAddProduct = async () => {
    if (role !== 'admin') {
      alert('Permission denied: Only Administrators can add products.');
      return;
    }

    const serverResp = await authorizedAddProduct(role, { name: 'New Product', price: 0, stock: 0 });
    if (!serverResp.success || !serverResp.data) {
      alert(`Server error: ${serverResp.error}`);
      return;
    }

    const newProduct: Product = {
      ...serverResp.data,
      serialNumber: products.length + 1,
    };

    const next = [...products, newProduct];
    setProducts(next);
    triggerAutoSave(next);
  };

  // Insert product at any specific serial number (Admin only)
  const handleInsertAtSerial = (
    targetSerial: number,
    name: string,
    price: number = 0,
    stock: number = 0
  ) => {
    if (role !== 'admin') return;

    const newProduct: Product = {
      _id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      serialNumber: targetSerial,
      name,
      price,
      stock,
    };

    const targetIndex = Math.max(0, Math.min(targetSerial - 1, products.length));
    const nextList = [...products];
    nextList.splice(targetIndex, 0, newProduct);

    const finalized = renumberProducts(nextList);
    setProducts(finalized);
    triggerAutoSave(finalized);
  };

  const handleInsertAbove = (serialNumber: number) => {
    handleInsertAtSerial(serialNumber, '', 0, 0);
  };

  const handleInsertBelow = (serialNumber: number) => {
    handleInsertAtSerial(serialNumber + 1, '', 0, 0);
  };

  // Batch Add (Admin only)
  const handleBatchAdd = (names: string[]) => {
    if (role !== 'admin') return;

    const timestamp = Date.now();
    const newItems: Product[] = names.map((name, idx) => ({
      _id: `prod_${timestamp}_${idx}`,
      serialNumber: products.length + idx + 1,
      name,
      price: 0,
      stock: 0,
    }));

    const next = renumberProducts([...products, ...newItems]);
    setProducts(next);
    triggerAutoSave(next);
  };

  // Reorder: Move Up (Admin only)
  const handleMoveUp = (serialNumber: number) => {
    if (role !== 'admin' || serialNumber <= 1) return;
    const index = serialNumber - 1;
    const nextList = [...products];
    const temp = nextList[index];
    nextList[index] = nextList[index - 1];
    nextList[index - 1] = temp;

    const finalized = renumberProducts(nextList);
    setProducts(finalized);
    triggerAutoSave(finalized);
  };

  // Reorder: Move Down (Admin only)
  const handleMoveDown = (serialNumber: number) => {
    if (role !== 'admin' || serialNumber >= products.length) return;
    const index = serialNumber - 1;
    const nextList = [...products];
    const temp = nextList[index];
    nextList[index] = nextList[index + 1];
    nextList[index + 1] = temp;

    const finalized = renumberProducts(nextList);
    setProducts(finalized);
    triggerAutoSave(finalized);
  };

  // Delete product (Admin only)
  const confirmDeleteProduct = async () => {
    if (!productToDelete || role !== 'admin') return;

    const serverResp = await authorizedDeleteProduct(role, productToDelete._id);
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
      return;
    }

    const nextList = products.filter((p) => p._id !== productToDelete._id);
    const finalized = renumberProducts(nextList);
    setProducts(finalized);
    triggerAutoSave(finalized);
    setProductToDelete(null);
  };

  // Submit Order (Normal User)
  const handlePlaceOrder = async () => {
    const items = products
      .filter(p => (userOrders[p._id] || 0) > 0)
      .map(p => ({
        productId: p._id,
        productName: p.name,
        price: p.price || 0,
        quantity: userOrders[p._id] || 0,
      }));

    if (items.length === 0) {
      alert('Please select at least one product before placing an order.');
      return;
    }

    const serverResp = await authorizedSubmitOrder('Customer User', items);
    if (!serverResp.success || !serverResp.data) {
      alert(`Order error: ${serverResp.error}`);
      return;
    }

    const formattedItems = items.map(item => ({
      name: item.productName,
      price: item.price,
      quantity: item.quantity,
      amount: item.price * item.quantity,
    }));

    setCompletedOrder({
      orderId: serverResp.data.orderId,
      items: formattedItems,
      grandTotal: serverResp.data.grandTotal,
    });
  };

  // 7. ROLE-BASED CALCULATIONS
  // Admin Statistics: Inventory valuation = Price * Stock
  const adminStats: AdminInventoryStats = useMemo(() => {
    let totalStock = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    for (const p of products) {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;

      totalStock += pStock;
      if (pStock === 0) outOfStockCount++;
      totalInventoryValue += pPrice * pStock;
    }

    return {
      totalProducts: products.length,
      totalStock,
      outOfStockCount,
      totalInventoryValue,
    };
  }, [products]);

  // User Order Statistics: Item Amount = Price * Ordered Qty, Grand Total = Sum(Price * Ordered Qty)
  const userStats: UserOrderStats = useMemo(() => {
    let totalOrderedItems = 0;
    let totalOrderedUnits = 0;
    let grandTotal = 0;

    for (const p of products) {
      const orderedQty = userOrders[p._id] || 0;
      const pPrice = p.price || 0;

      if (orderedQty > 0) {
        totalOrderedItems++;
        totalOrderedUnits += orderedQty;
        // EXACT FORMULA: Price × Ordered Quantity
        grandTotal += pPrice * orderedQty;
      }
    }

    return {
      totalProducts: products.length,
      totalOrderedItems,
      totalOrderedUnits,
      grandTotal,
    };
  }, [products, userOrders]);

  // Filtered products based on search & filter tabs
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (filter === 'in_stock') return (p.stock || 0) > 0;
      if (filter === 'out_of_stock') return (p.stock || 0) === 0;
      if (filter === 'need_order') {
        const orderQty = userOrders[p._id] || 0;
        return orderQty > 0;
      }

      return true;
    });
  }, [products, searchQuery, filter, userOrders]);

  // Filter counts for badges
  const filterCounts = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    let needOrder = 0;

    for (const p of products) {
      if ((p.stock || 0) > 0) inStock++;
      if ((p.stock || 0) === 0) outOfStock++;
      if ((userOrders[p._id] || 0) > 0) needOrder++;
    }

    return {
      all: products.length,
      inStock,
      outOfStock,
      needOrder,
    };
  }, [products, userOrders]);

  const handlePrintSheet = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* 1. Header with Role Switcher */}
      <InventoryHeader
        role={role}
        onRoleChange={handleRoleChange}
        meta={meta}
        onMetaChange={handleMetaChange}
        saveStatus={saveStatus}
        onManualSave={handleManualSave}
        onAddProduct={handleAddProduct}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenInsertModal={() => setIsInsertModalOpen(true)}
        onDownloadPdf={handleDownloadPdf}
        onPrintSheet={handlePrintSheet}
        totalProducts={products.length}
        userOrderCount={userStats.totalOrderedItems}
        userGrandTotal={userStats.grandTotal}
        onPlaceOrder={handlePlaceOrder}
        onClearOrder={handleClearOrder}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* 2. Key Metrics Summary Dashboard (Role Specific) */}
        <InventorySummary 
          role={role}
          adminStats={adminStats} 
          userStats={userStats} 
          currency={meta.currency} 
        />

        {/* 3. Search and Filter Bar */}
        <SearchAndFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filter={filter}
          onFilterChange={setFilter}
          totalCount={filterCounts.all}
          filteredCount={filteredProducts.length}
          inStockCount={filterCounts.inStock}
          outOfStockCount={filterCounts.outOfStock}
          needOrderCount={filterCounts.needOrder}
        />

        {/* 4. Main Invoice / Inventory Container */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Banner */}
          <div className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            isAdmin ? 'bg-amber-50/40 border-amber-200/60' : 'bg-indigo-50/40 border-indigo-200/60'
          }`}>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isAdmin ? 'ADMIN INVENTORY LEDGER' : 'CUSTOMER ORDER SHEET'} • {filteredProducts.length} OF {products.length} PRODUCTS
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-3">
              {isAdmin ? (
                <span>Manage stock & edit products directly</span>
              ) : (
                <span>Amount = Price × Ordered Quantity • Live Grand Total</span>
              )}
            </div>
          </div>

          {products.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <PackageIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No products available</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                {isAdmin 
                  ? 'Add your first product to begin managing inventory.' 
                  : 'The store has not added any products yet. Please check back later.'}
              </p>
              {isAdmin && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4" />
                    + Add First Product
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-3 min-w-[200px]">Product Name</th>
                      <th className="py-3 px-3 w-28 text-right">Price ({meta.currency})</th>
                      <th className="py-3 px-3 w-36 text-center">
                        {isAdmin ? 'Warehouse Stock' : 'Stock Availability'}
                      </th>
                      <th className="py-3 px-3 w-36 text-center">
                        {isAdmin ? 'Re-order Benchmark' : 'Order Qty'}
                      </th>
                      <th className="py-3 px-3 w-32 text-right">
                        {isAdmin ? `Stock Value (${meta.currency})` : `Amount (${meta.currency})`}
                      </th>
                      <th className="py-3 px-3 w-40 text-right">
                        {isAdmin ? 'Actions' : 'Status'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product, idx) => (
                      <InventoryRow
                        key={product._id}
                        product={product}
                        index={idx}
                        totalProducts={products.length}
                        role={role}
                        currency={meta.currency}
                        userOrderQty={userOrders[product._id] || 0}
                        onUserOrderQtyChange={updateUserOrderQty}
                        onUpdate={handleUpdateProduct}
                        onInsertAbove={handleInsertAbove}
                        onInsertBelow={handleInsertBelow}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onDeleteRequest={setProductToDelete}
                      />
                    ))}
                  </tbody>
                  {/* Table Footer with Exact Grand Total */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={2} className="py-3.5 px-4">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={handleAddProduct}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>+ Add Another Product</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            Adjust quantities above to calculate your total
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-slate-600 uppercase">
                        Grand Total:
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-bold text-slate-800">
                        {isAdmin ? `${adminStats.totalStock.toLocaleString()} units` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-bold text-indigo-700">
                        {isAdmin ? '—' : `${userStats.totalOrderedUnits.toLocaleString()} units`}
                      </td>
                      <td className="py-3 px-3 text-right text-base font-black text-indigo-950">
                        {meta.currency}{isAdmin 
                          ? adminStats.totalInventoryValue.toLocaleString() 
                          : userStats.grandTotal.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isAdmin && userStats.totalOrderedItems > 0 && (
                          <button
                            type="button"
                            onClick={handlePlaceOrder}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
                          >
                            Place Order
                          </button>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
                {filteredProducts.map((product) => (
                  <MobileInventoryCard
                    key={product._id}
                    product={product}
                    totalProducts={products.length}
                    role={role}
                    currency={meta.currency}
                    userOrderQty={userOrders[product._id] || 0}
                    onUserOrderQtyChange={updateUserOrderQty}
                    onUpdate={handleUpdateProduct}
                    onInsertAbove={handleInsertAbove}
                    onInsertBelow={handleInsertBelow}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDeleteRequest={setProductToDelete}
                  />
                ))}

                {/* Mobile Bottom Action Button */}
                <div className="pt-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="w-full py-3 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-xl shadow-xs cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4" />
                      + Add New Product
                    </button>
                  ) : (
                    userStats.totalOrderedItems > 0 && (
                      <button
                        type="button"
                        onClick={handlePlaceOrder}
                        className="w-full py-3 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer"
                      >
                        <ShoppingCartIcon className="w-4 h-4" />
                        Place Order ({meta.currency}{userStats.grandTotal.toLocaleString()})
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Bottom Summary Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> products
                  {!isAdmin && userStats.totalOrderedItems > 0 && (
                    <span className="ml-2 text-indigo-700 font-semibold">
                      ({userStats.totalOrderedItems} items selected in order)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-slate-600 uppercase text-xs tracking-wider">
                    {isAdmin ? 'Inventory Value:' : 'Order Grand Total:'}
                  </span>
                  <span className="text-xl font-black text-indigo-700">
                    {meta.currency}{isAdmin 
                      ? adminStats.totalInventoryValue.toLocaleString() 
                      : userStats.grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 5. Modals & Dialogs */}
      {isAdmin && (
        <>
          <QuickBatchAddModal
            isOpen={isBatchModalOpen}
            onClose={() => setIsBatchModalOpen(false)}
            onAddProducts={handleBatchAdd}
          />

          <InsertAtSerialModal
            isOpen={isInsertModalOpen}
            maxSerial={products.length}
            onClose={() => setIsInsertModalOpen(false)}
            onInsert={handleInsertAtSerial}
          />

          <ConfirmDialog
            isOpen={productToDelete !== null}
            title="Delete Product?"
            message={`Are you sure you want to delete "${productToDelete?.name || 'this product'}" (Serial #${productToDelete?.serialNumber})? All subsequent products will automatically move up by one serial number.`}
            confirmText="Delete Product"
            cancelText="Keep Product"
            onConfirm={confirmDeleteProduct}
            onCancel={() => setProductToDelete(null)}
            isDestructive={true}
          />
        </>
      )}

      {/* Order Success Modal (Normal User) */}
      <OrderSuccessModal
        isOpen={completedOrder !== null}
        orderId={completedOrder?.orderId || ''}
        customerName="Customer User"
        items={completedOrder?.items || []}
        grandTotal={completedOrder?.grandTotal || 0}
        currency={meta.currency}
        onClose={() => setCompletedOrder(null)}
        onDownloadInvoice={handleDownloadPdf}
      />

      {/* Printable Invoice View */}
      <PrintableInvoice
        products={products}
        meta={meta}
        role={role}
        userOrders={userOrders}
        userGrandTotal={userStats.grandTotal}
        adminGrandTotal={adminStats.totalInventoryValue}
        totalAdminStock={adminStats.totalStock}
        totalUserOrderedUnits={userStats.totalOrderedUnits}
      />
    </div>
  );
}
