'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Product, 
  FilterType, 
  SaveStatus, 
  InvoiceMeta, 
  UserRole,
  AdminInventoryStats,
  UserOrderStats,
  CustomerOrder
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
import { SharedOrdersModal } from './SharedOrdersModal';
import { PrintableInvoice } from './PrintableInvoice';
import { generateInvoicePdf, generateSharedOrderPdf } from '@/utils/invoicePdfGenerator';
import { PlusIcon, PackageIcon } from './icons';
import { 
  authorizedAddProduct, 
  authorizedUpdateProduct, 
  authorizedDeleteProduct, 
  authorizedSubmitOrder,
  authorizedInsertAtSerial,
  authorizedBatchAdd,
  authorizedMoveProduct,
  authorizedUpdateMeta,
  verifyExistingAdminSession
} from '@/actions/authorizedProductActions';

// Fallback initial master catalog for Shondani Medical Hall
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

const LOCAL_STORAGE_ADMIN_TOKEN = 'shondani_admin_token_v3';

export function InventorySheet() {
  // 1. Role & Auth State
  const [role, setRole] = useState<UserRole>('user');
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // 2. Authoritative Master Product Catalog (One central source of truth)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);

  // 3. User Order Draft Quantities (Temporary selections before placing order)
  const [userOrders, setUserOrders] = useState<Record<string, number>>({});

  // 4. Central Orders History (Shared across all devices)
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  // 5. Realtime & Sync Connection State
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [liveNotification, setLiveNotification] = useState<{ message: string; orderId?: string } | null>(null);

  // 6. Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // 7. Invoice Metadata for Shondani Medical Hall
  const [meta, setMeta] = useState<InvoiceMeta>({
    shopName: 'Shondani Medical Hall',
    invoiceTitle: 'INVENTORY / INVOICE',
    invoiceNumber: 'SMH-2025-001',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    currency: '৳',
  });

  // 8. Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    items: Array<{ name: string; price: number; quantity: number; amount: number }>;
    grandTotal: number;
  } | null>(null);

  // Pending updates ref for debouncing product field changes to server
  const pendingUpdatesRef = useRef<Record<string, Partial<Product>>>({});
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss live notification toast after 6 seconds
  useEffect(() => {
    if (liveNotification) {
      const timer = setTimeout(() => {
        setLiveNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [liveNotification]);

  // Sync state from central database
  const syncFromCentral = useCallback(async () => {
    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        if (data.meta) {
          setMeta(data.meta);
        }
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.warn('Sync from central DB failed:', err);
    }
  }, []);

  // Initial load & real-time SSE subscription
  useEffect(() => {
    // 1. Fetch initial central database state
    syncFromCentral();

    // 2. Check saved admin session
    try {
      const savedToken = localStorage.getItem(LOCAL_STORAGE_ADMIN_TOKEN);
      if (savedToken && savedToken.startsWith('admin_session_')) {
        verifyExistingAdminSession(savedToken).then((isValid) => {
          if (isValid) {
            setAdminToken(savedToken);
            setRole('admin');
          } else {
            setAdminToken(null);
            setRole('user');
            localStorage.removeItem(LOCAL_STORAGE_ADMIN_TOKEN);
          }
        });
      }
    } catch {
      // ignore
    }

    // 3. Connect to Server-Sent Events (SSE) for Real-Time synchronization across all devices
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');

      es.onopen = () => {
        setIsRealtimeConnected(true);
      };

      es.onerror = () => {
        setIsRealtimeConnected(false);
      };

      es.addEventListener('PRODUCTS_UPDATED', (e: MessageEvent) => {
        try {
          const updatedProducts: Product[] = JSON.parse(e.data);
          if (Array.isArray(updatedProducts)) {
            setProducts(updatedProducts);
          }
        } catch (err) {
          console.error('Failed to parse PRODUCTS_UPDATED event', err);
        }
      });

      es.addEventListener('ORDER_PLACED', (e: MessageEvent) => {
        try {
          const payload: { order: CustomerOrder; updatedProducts: Product[] } = JSON.parse(e.data);
          if (payload.order) {
            setOrders(prev => {
              const exists = prev.some(o => o.orderId === payload.order.orderId);
              return exists ? prev : [payload.order, ...prev];
            });
            setLiveNotification({
              message: `Order #${payload.order.orderId.slice(-6)} placed for ৳${payload.order.grandTotal.toLocaleString()}`,
              orderId: payload.order.orderId,
            });
          }
          if (Array.isArray(payload.updatedProducts)) {
            setProducts(payload.updatedProducts);
          }
        } catch (err) {
          console.error('Failed to parse ORDER_PLACED event', err);
        }
      });

      es.addEventListener('META_UPDATED', (e: MessageEvent) => {
        try {
          const updatedMeta: InvoiceMeta = JSON.parse(e.data);
          if (updatedMeta) {
            setMeta(updatedMeta);
          }
        } catch (err) {
          console.error('Failed to parse META_UPDATED event', err);
        }
      });
    } catch (err) {
      console.error('Failed to connect to SSE realtime hub:', err);
    }

    // 4. Handle visibility change (e.g. mobile device awakens from sleep)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromCentral();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (es) es.close();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncFromCentral]);

  // Flush pending product edits to the server
  const flushPendingProductUpdates = useCallback(async () => {
    if (!adminToken) return;
    const pending = pendingUpdatesRef.current;
    pendingUpdatesRef.current = {};
    const ids = Object.keys(pending);
    if (ids.length === 0) return;

    setSaveStatus('saving');
    try {
      for (const id of ids) {
        await authorizedUpdateProduct(adminToken, id, pending[id]);
      }
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error saving product updates:', err);
      setSaveStatus('error');
    }
  }, [adminToken]);

  // Update product fields (Admin only, debounced server sync)
  const handleUpdateProduct = useCallback((id: string, updates: Partial<Product>) => {
    if (role !== 'admin' || !adminToken) {
      alert('Permission denied: Only Administrator can edit products.');
      return;
    }

    // 1. Optimistic UI update
    setProducts(prev => prev.map(p => (p._id === id ? { ...p, ...updates } : p)));
    setSaveStatus('unsaved');

    // 2. Queue for server sync
    pendingUpdatesRef.current[id] = {
      ...pendingUpdatesRef.current[id],
      ...updates,
    };

    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = setTimeout(() => {
      flushPendingProductUpdates();
    }, 450);
  }, [role, adminToken, flushPendingProductUpdates]);

  // Manual Save (Admin only)
  const handleManualSave = () => {
    if (role !== 'admin') return;
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    flushPendingProductUpdates();
  };

  // Update shop metadata (Admin only)
  const handleMetaChange = async (updatedMeta: Partial<InvoiceMeta>) => {
    if (role !== 'admin' || !adminToken) return;
    setMeta(prev => ({ ...prev, ...updatedMeta }));
    await authorizedUpdateMeta(adminToken, updatedMeta);
  };

  // User Order Quantity Updates (Draft selections)
  const updateUserOrderQty = useCallback((productId: string, newQty: number) => {
    setUserOrders(prev => ({
      ...prev,
      [productId]: Math.max(0, newQty),
    }));
  }, []);

  const handleClearOrder = () => {
    setUserOrders({});
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

  // Add a single blank product at the end (Admin only)
  const handleAddProduct = async () => {
    if (role !== 'admin' || !adminToken) {
      alert('Permission denied: Only Administrator can add products.');
      return;
    }

    const serverResp = await authorizedAddProduct(adminToken, { name: 'New Product', price: 0, stock: 0 });
    if (!serverResp.success || !serverResp.data) {
      alert(`Server error: ${serverResp.error}`);
    }
  };

  // Insert product at specific serial number (Admin only)
  const handleInsertAtSerial = useCallback(async (
    targetSerial: number,
    name: string,
    price: number = 0,
    stock: number = 0
  ) => {
    if (role !== 'admin' || !adminToken) return;

    const serverResp = await authorizedInsertAtSerial(adminToken, targetSerial, name, price, stock);
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
    }
  }, [role, adminToken]);

  const handleInsertAbove = useCallback((serialNumber: number) => {
    handleInsertAtSerial(serialNumber, '', 0, 0);
  }, [handleInsertAtSerial]);

  const handleInsertBelow = useCallback((serialNumber: number) => {
    handleInsertAtSerial(serialNumber + 1, '', 0, 0);
  }, [handleInsertAtSerial]);

  // Batch Add Products (Admin only)
  const handleBatchAdd = async (names: string[]) => {
    if (role !== 'admin' || !adminToken) return;

    const serverResp = await authorizedBatchAdd(adminToken, names);
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
    }
  };

  // Move product up/down (Admin only)
  const handleMoveUp = useCallback(async (serialNumber: number) => {
    if (role !== 'admin' || !adminToken || serialNumber <= 1) return;

    const serverResp = await authorizedMoveProduct(adminToken, serialNumber, 'up');
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
    }
  }, [role, adminToken]);

  const handleMoveDown = useCallback(async (serialNumber: number) => {
    if (role !== 'admin' || !adminToken) return;

    const serverResp = await authorizedMoveProduct(adminToken, serialNumber, 'down');
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
    }
  }, [role, adminToken]);

  // Confirm delete product (Admin only)
  const confirmDeleteProduct = async () => {
    if (!productToDelete || role !== 'admin' || !adminToken) return;

    const serverResp = await authorizedDeleteProduct(adminToken, productToDelete._id);
    if (!serverResp.success) {
      alert(`Server error: ${serverResp.error}`);
      return;
    }

    setProductToDelete(null);
  };

  // Submit Order (Available to any user on any phone/device)
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

    // Reset draft selections
    setUserOrders({});
  };

  // 9. ROLE-BASED CALCULATIONS
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
    const count = isAdmin ? products.filter(p => (p.stock || 0) > 0).length : userStats.totalOrderedItems;
    if (count === 0) {
      alert('No products to invoice. Please order or select at least one product before printing.');
      return;
    }
    window.print();
  };

  const handleDownloadPdf = (customInvoiceNumber?: string) => {
    const count = isAdmin ? products.filter(p => (p.stock || 0) > 0).length : userStats.totalOrderedItems;
    if (count === 0) {
      alert('No products to invoice. Please order or select at least one product before generating an invoice.');
      return;
    }

    const currentMeta = customInvoiceNumber 
      ? { ...meta, invoiceNumber: customInvoiceNumber }
      : meta;

    const res = generateInvoicePdf({
      products,
      meta: currentMeta,
      role,
      userOrders,
      customerName: 'Customer User',
      autoDownload: true,
    });

    if (!res.success) {
      alert(res.message || res.error || 'No products to invoice');
    }
  };

  const handleDownloadOrderInvoice = (orderId: string) => {
    const targetOrder = orders.find(o => o.orderId === orderId);
    if (targetOrder) {
      generateSharedOrderPdf(targetOrder, meta, true);
    } else {
      handleDownloadPdf(orderId);
    }
  };

  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-slate-100/70 pb-6 sm:pb-10">
      <div className="print:hidden">
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
          onDownloadPdf={() => handleDownloadPdf()}
          onPrintSheet={handlePrintSheet}
          totalProducts={products.length}
          userOrderCount={userStats.totalOrderedItems}
          userGrandTotal={userStats.grandTotal}
          onPlaceOrder={handlePlaceOrder}
          onClearOrder={handleClearOrder}
          sharedOrdersCount={orders.length}
          onOpenSharedOrders={() => setIsOrdersModalOpen(true)}
          isRealtimeConnected={isRealtimeConnected}
        />

        <main className="max-w-7xl mx-auto px-1.5 sm:px-4 py-2 sm:py-3.5 space-y-2 sm:space-y-3">
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

          {/* 4. Main Responsive Table Sheet (NATURAL FLOW, NO VERTICAL SCROLLBAR) */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            {/* Banner */}
            <div className={`px-2.5 sm:px-4 py-1 sm:py-1.5 border-b flex flex-wrap items-center justify-between gap-2 ${
              isAdmin ? 'bg-amber-50/50 border-amber-200/60' : 'bg-indigo-50/50 border-indigo-200/60'
            }`}>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700">
                  {isAdmin ? 'SHONDANI ADMIN INVENTORY' : 'SHONDANI PRODUCT ORDER SHEET'} • {filteredProducts.length} OF {products.length} PRODUCTS
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-2 sm:gap-3">
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
              /* NATURAL FIT RESPONSIVE TABLE FOR MOBILE & DESKTOP */
              <div className="overflow-x-auto sm:overflow-x-visible -webkit-overflow-scrolling-touch">
                <table className="w-full text-left border-collapse sm:min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="hidden sm:table-cell py-1.5 px-1 sm:px-2 text-center w-8 sm:w-12 sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                        #
                      </th>
                      <th className="py-1.5 px-1 sm:px-2 min-w-[105px] sm:min-w-[180px]">
                        Product Name
                      </th>
                      <th className="py-1.5 px-0.5 sm:px-2 w-14 sm:w-24 text-right">
                        Price ({meta.currency})
                      </th>
                      <th className="py-1.5 px-0.5 sm:px-2 w-14 sm:w-28 text-center">
                        {isAdmin ? 'Warehouse Stock' : 'Stock'}
                      </th>
                      <th className={`py-1.5 px-0.5 sm:px-2 ${isAdmin ? 'hidden md:table-cell w-20 sm:w-32' : 'w-20 sm:w-32'} text-center`}>
                        {isAdmin ? 'Target Qty' : 'Order Qty'}
                      </th>
                      <th className="py-1.5 px-1 sm:px-2.5 w-16 sm:w-28 text-right">
                        {isAdmin ? `Stock Value (${meta.currency})` : `Amount (${meta.currency})`}
                      </th>
                      <th className={`py-1.5 px-0.5 sm:px-2 text-right ${isAdmin ? 'w-16 sm:w-32' : 'hidden sm:table-cell w-16 sm:w-24'}`}>
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
                      <td className="hidden sm:table-cell py-1.5 px-1 sm:px-2 sticky left-0 z-10 bg-slate-50"></td>
                      <td className="py-1.5 px-1 sm:px-2 bg-slate-50">
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
                          <span className="text-[10px] sm:text-xs font-semibold text-slate-500">
                            Live calculation:
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-0.5 sm:px-2 text-right text-[11px] sm:text-xs font-bold text-slate-600 uppercase">
                        Grand Total:
                      </td>
                      <td className="py-1.5 px-0.5 sm:px-2 text-center text-xs font-bold text-slate-800">
                        {isAdmin ? `${adminStats.totalStock.toLocaleString()} units` : '—'}
                      </td>
                      <td className={`py-1.5 px-0.5 sm:px-2 text-center text-xs font-bold text-indigo-700 ${isAdmin ? 'hidden md:table-cell' : ''}`}>
                        {isAdmin ? '—' : `${userStats.totalOrderedUnits.toLocaleString()} units`}
                      </td>
                      <td className="py-1.5 px-1 sm:px-2.5 text-right text-xs sm:text-base font-black text-indigo-950">
                        {meta.currency}{isAdmin 
                          ? adminStats.totalInventoryValue.toLocaleString() 
                          : userStats.grandTotal.toLocaleString()}
                      </td>
                      <td className={`py-1.5 px-0.5 sm:px-2 text-right ${isAdmin ? 'w-16 sm:w-32' : 'hidden sm:table-cell'}`}>
                        {!isAdmin && userStats.totalOrderedItems > 0 && (
                          <button
                            type="button"
                            onClick={handlePlaceOrder}
                            className="px-2 sm:px-3 py-1 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
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
            <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> products
                {!isAdmin && userStats.totalOrderedItems > 0 && (
                  <span className="ml-2 text-indigo-700 font-bold">
                    ({userStats.totalOrderedItems} items selected in order)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
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
        {/* Admin Login Modal (Omar / Omar88067) */}
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
          onDownloadInvoice={() => handleDownloadOrderInvoice(completedOrder?.orderId || '')}
        />

        {/* Shared Orders History Modal (Central database orders, downloadable by any device) */}
        <SharedOrdersModal
          isOpen={isOrdersModalOpen}
          onClose={() => setIsOrdersModalOpen(false)}
          orders={orders}
          meta={meta}
        />

        {/* Real-time Order Notification Toast */}
        {liveNotification && (
          <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in">
            <span className="text-xl">🔔</span>
            <div className="text-xs">
              <div className="font-bold text-amber-400">Live Central Update</div>
              <div>{liveNotification.message}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOrdersModalOpen(true);
                setLiveNotification(null);
              }}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md cursor-pointer ml-1"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setLiveNotification(null)}
              className="text-slate-400 hover:text-white p-1 text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

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
