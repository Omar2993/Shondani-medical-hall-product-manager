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
import { QuickBatchAddModal } from './QuickBatchAddModal';
import { InsertAtSerialModal } from './InsertAtSerialModal';
import { ConfirmDialog } from './ConfirmDialog';
import { AdminLoginModal } from './AdminLoginModal';
import { OrderSuccessModal } from './OrderSuccessModal';
import { PrintableInvoice } from './PrintableInvoice';
import { PlusIcon, PackageIcon } from './icons';
import { 
  authorizedAddProduct, 
  authorizedUpdateProduct, 
  authorizedDeleteProduct, 
  authorizedSubmitOrder 
} from '@/actions/authorizedProductActions';

// Initial master catalog for Shondani Medical Hall
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
  {
    _id: 'prod_6',
    serialNumber: 6,
    name: 'Anklet Support',
    price: 280,
    stock: 18,
  },
  {
    _id: 'prod_7',
    serialNumber: 7,
    name: 'Surgical Tape 1-inch',
    price: 65,
    stock: 50,
  },
];

const LOCAL_STORAGE_KEY = 'shondani_catalog_data_v3';
const LOCAL_STORAGE_ORDERS_KEY = 'shondani_user_orders_v3';
const LOCAL_STORAGE_META_KEY = 'shondani_sheet_meta_v3';
const LOCAL_STORAGE_ADMIN_TOKEN = 'shondani_admin_token_v3';

export function InventorySheet() {
  // 1. Role State: Default to 'user' so customers cannot see admin controls without authenticating
  const [role, setRole] = useState<UserRole>('user');
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // 2. Master Product Catalog (Managed exclusively by Admin)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);

  // 3. User Order Quantities (Completely separate from Admin warehouse stock)
  const [userOrders, setUserOrders] = useState<Record<string, number>>({
    prod_1: 10,
    prod_2: 5,
    prod_3: 6,
  });

  // 4. Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // 5. Invoice Metadata for Shondani Medical Hall
  const [meta, setMeta] = useState<InvoiceMeta>({
    shopName: 'Shondani Medical Hall',
    invoiceTitle: 'INVENTORY / INVOICE',
    invoiceNumber: 'SMH-2025-001',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currency: '৳',
  });

  // 6. Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
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

  // Renumber helper
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
      const savedToken = localStorage.getItem(LOCAL_STORAGE_ADMIN_TOKEN);

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

      // Check for saved admin session
      if (savedToken && savedToken.startsWith('admin_session_')) {
        setAdminToken(savedToken);
        setRole('admin');
      }
    } catch {
      console.warn('Could not read from localStorage');
    }
  }, []);

  // Safe Debounced Auto-Save for Admin
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

  // Persist User Order Qty
  const updateUserOrderQty = useCallback((productId: string, newQty: number) => {
    setUserOrders(prev => {
      const updated = { ...prev, [productId]: Math.max(0, newQty) };
      try {
        localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const handleClearOrder = () => {
    setUserOrders({});
    try {
      localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
    } catch {
      // ignore
    }
  };

  // Admin Authentication Callbacks
  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    setRole('admin');
    try {
      localStorage.setItem(LOCAL_STORAGE_ADMIN_TOKEN, token);
    } catch {
      // ignore
    }
  };

  const handleLogoutAdmin = () => {
    setAdminToken(null);
    setRole('user');
    try {
      localStorage.removeItem(LOCAL_STORAGE_ADMIN_TOKEN);
    } catch {
      // ignore
    }
  };

  // Manual Save (Admin only)
  const handleManualSave = () => {
    if (role !== 'admin') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('saving');
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
      localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(meta));
      setTimeout(() => {
        setSaveStatus('saved');
      }, 300);
    } catch (err) {
      console.error('Manual save failed', err);
      setSaveStatus('error');
    }
  };

  // Update Product fields (Admin only, wrapped in useCallback to keep row memoization fast)
  const handleUpdateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    if (role !== 'admin') {
      alert('Permission denied: Only Administrator can edit products.');
      return;
    }

    setProducts((prev) => {
      const next = prev.map((p) => (p._id === id ? { ...p, ...updates } : p));
      triggerAutoSave(next);
      return next;
    });

    // Background server validation
    authorizedUpdateProduct(role, id, {
      name: updates.name,
      price: updates.price,
      stock: updates.stock,
    }).catch(console.error);
  }, [role, triggerAutoSave]);

  const handleMetaChange = (updatedMeta: Partial<InvoiceMeta>) => {
    if (role !== 'admin') return;
    setMeta((prev) => {
      const next = { ...prev, ...updatedMeta };
      triggerAutoSave(products, next);
      return next;
    });
  };

  // Add a single blank product at end
  const handleAddProduct = async () => {
    if (role !== 'admin') {
      alert('Permission denied: Only Administrator can add products.');
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

  // Insert product at any specific serial number
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

  const handleInsertAbove = useCallback((serialNumber: number) => {
    handleInsertAtSerial(serialNumber, '', 0, 0);
  }, [products]);

  const handleInsertBelow = useCallback((serialNumber: number) => {
    handleInsertAtSerial(serialNumber + 1, '', 0, 0);
  }, [products]);

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

  const handleMoveUp = useCallback((serialNumber: number) => {
    if (role !== 'admin' || serialNumber <= 1) return;
    setProducts(prev => {
      const index = serialNumber - 1;
      const nextList = [...prev];
      const temp = nextList[index];
      nextList[index] = nextList[index - 1];
      nextList[index - 1] = temp;
      const finalized = renumberProducts(nextList);
      triggerAutoSave(finalized);
      return finalized;
    });
  }, [role, triggerAutoSave]);

  const handleMoveDown = useCallback((serialNumber: number) => {
    if (role !== 'admin') return;
    setProducts(prev => {
      if (serialNumber >= prev.length) return prev;
      const index = serialNumber - 1;
      const nextList = [...prev];
      const temp = nextList[index];
      nextList[index] = nextList[index + 1];
      nextList[index + 1] = temp;
      const finalized = renumberProducts(nextList);
      triggerAutoSave(finalized);
      return finalized;
    });
  }, [role, triggerAutoSave]);

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
      {/* 1. Header with Shondani Medical Hall branding & Role Switcher */}
      <InventoryHeader
        role={role}
        onRoleChange={setRole}
        onOpenAdminLogin={() => setIsLoginModalOpen(true)}
        onLogoutAdmin={handleLogoutAdmin}
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

      <main className="max-w-7xl mx-auto px-2 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-5">
        {/* 2. Key Metrics Summary Dashboard */}
        <InventorySummary 
          role={role}
          adminStats={adminStats} 
          userStats={userStats} 
          currency={meta.currency} 
        />

        {/* 3. Search and Filter Bar (Optimized for fast mobile typing) */}
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

        {/* 4. Main Responsive Table Sheet (UNIFIED TABLE LAYOUT FOR MOBILE & DESKTOP) */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Banner */}
          <div className={`px-3 sm:px-5 py-2.5 sm:py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
            isAdmin ? 'bg-amber-50/50 border-amber-200/60' : 'bg-indigo-50/50 border-indigo-200/60'
          }`}>
            <div>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700">
                {isAdmin ? 'SHONDANI ADMIN INVENTORY' : 'SHONDANI PRODUCT ORDER SHEET'} • {filteredProducts.length} OF {products.length} PRODUCTS
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-2 sm:gap-3">
              <span>Swipe horizontally to view all columns</span>
              <span>•</span>
              <span>{isAdmin ? 'Value = Price × Stock' : 'Amount = Price × Order Qty'}</span>
            </div>
          </div>

          {products.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-4 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <PackageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">No products available</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                {isAdmin 
                  ? 'Add your first product to Shondani Medical Hall inventory.' 
                  : 'Products will appear here once added by the administrator.'}
              </p>
              {isAdmin && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4" />
                    + Add First Product
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* UNIFIED SIDE-BY-SIDE RESPONSIVE TABLE FOR MOBILE & DESKTOP */
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-left border-collapse min-w-[620px] sm:min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-1.5 sm:px-2.5 text-center w-9 sm:w-12 sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                      #
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-3 min-w-[130px] sm:min-w-[200px]">
                      Product Name
                    </th>
                    <th className="py-2.5 px-1 sm:px-2.5 w-20 sm:w-28 text-right">
                      Price ({meta.currency})
                    </th>
                    <th className="py-2.5 px-1 sm:px-2.5 w-28 sm:w-36 text-center">
                      {isAdmin ? 'Warehouse Stock' : 'Stock'}
                    </th>
                    <th className="py-2.5 px-1 sm:px-2.5 w-28 sm:w-36 text-center">
                      {isAdmin ? 'Target Qty' : 'Order Qty'}
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-3 w-24 sm:w-32 text-right">
                      {isAdmin ? `Stock Value (${meta.currency})` : `Amount (${meta.currency})`}
                    </th>
                    <th className="py-2.5 px-1 sm:px-2.5 w-24 sm:w-36 text-right">
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
                    <td colSpan={2} className="py-3 px-3 sm:px-4 sticky left-0 z-10 bg-slate-50">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={handleAddProduct}
                          className="flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 cursor-pointer"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>+ Add Another Product</span>
                        </button>
                      ) : (
                        <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                          Total calculated live:
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-1 sm:px-2.5 text-right text-xs font-bold text-slate-600 uppercase">
                      Grand Total:
                    </td>
                    <td className="py-3 px-1 sm:px-2.5 text-center text-xs font-bold text-slate-800">
                      {isAdmin ? `${adminStats.totalStock.toLocaleString()} units` : '—'}
                    </td>
                    <td className="py-3 px-1 sm:px-2.5 text-center text-xs font-bold text-indigo-700">
                      {isAdmin ? '—' : `${userStats.totalOrderedUnits.toLocaleString()} units`}
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 text-right text-sm sm:text-base font-black text-indigo-950">
                      {meta.currency}{isAdmin 
                        ? adminStats.totalInventoryValue.toLocaleString() 
                        : userStats.grandTotal.toLocaleString()}
                    </td>
                    <td className="py-3 px-1 sm:px-2.5 text-right">
                      {!isAdmin && userStats.totalOrderedItems > 0 && (
                        <button
                          type="button"
                          onClick={handlePlaceOrder}
                          className="px-2.5 sm:px-3 py-1 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
                        >
                          Place Order
                        </button>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Bottom Summary Bar */}
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-xs text-slate-600">
              Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> products
              {!isAdmin && userStats.totalOrderedItems > 0 && (
                <span className="ml-2 text-indigo-700 font-bold">
                  ({userStats.totalOrderedItems} items selected in order)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-bold text-slate-600 uppercase text-xs tracking-wider">
                {isAdmin ? 'Total Inventory Value:' : 'Grand Total:'}
              </span>
              <span className="text-lg sm:text-xl font-black text-indigo-700">
                {meta.currency}{isAdmin 
                  ? adminStats.totalInventoryValue.toLocaleString() 
                  : userStats.grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Modals & Dialogs */}
      {/* Admin Login Modal (omar / Omar88067) */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Admin Operations Modals */}
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
            title="Delete Product from Shondani?"
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
