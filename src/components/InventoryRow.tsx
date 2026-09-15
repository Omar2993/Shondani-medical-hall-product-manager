'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { Product, UserRole } from '@/types/product';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon 
} from './icons';

interface InventoryRowProps {
  product: Product;
  index: number;
  totalProducts: number;
  role: UserRole;
  currency?: string;
  userOrderQty: number;
  onUserOrderQtyChange: (productId: string, newQty: number) => void;
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onInsertAbove: (serialNumber: number) => void;
  onInsertBelow: (serialNumber: number) => void;
  onMoveUp: (serialNumber: number) => void;
  onMoveDown: (serialNumber: number) => void;
  onDeleteRequest: (product: Product) => void;
}

export const InventoryRow = memo(function InventoryRow({
  product,
  index,
  totalProducts,
  role,
  currency = '৳',
  userOrderQty = 0,
  onUserOrderQtyChange,
  onUpdate,
  onInsertAbove,
  onInsertBelow,
  onMoveUp,
  onMoveDown,
  onDeleteRequest,
}: InventoryRowProps) {
  const isAdmin = role === 'admin';

  // 1. LOCAL BUFFERED STATE for 60 FPS lag-free mobile typing
  const [localName, setLocalName] = useState(product.name || '');
  const [localPrice, setLocalPrice] = useState(product.price === 0 ? '' : String(product.price));
  const [localStock, setLocalStock] = useState(product.stock === 0 ? '' : String(product.stock));
  const [localOrderQty, setLocalOrderQty] = useState(userOrderQty === 0 ? '' : String(userOrderQty));

  // Debounce timers
  const nameDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const priceDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const stockDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const orderDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync props to local state if changed externally
  useEffect(() => {
    setLocalName(product.name || '');
  }, [product.name]);

  useEffect(() => {
    setLocalPrice(product.price === 0 ? '' : String(product.price));
  }, [product.price]);

  useEffect(() => {
    setLocalStock(product.stock === 0 ? '' : String(product.stock));
  }, [product.stock]);

  useEffect(() => {
    setLocalOrderQty(userOrderQty === 0 ? '' : String(userOrderQty));
  }, [userOrderQty]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
      if (stockDebounceRef.current) clearTimeout(stockDebounceRef.current);
      if (orderDebounceRef.current) clearTimeout(orderDebounceRef.current);
    };
  }, []);

  // --- Fast Typing Handlers ---
  const handleNameChange = (val: string) => {
    setLocalName(val);
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => {
      onUpdate(product._id, { name: val });
    }, 150);
  };

  const handlePriceChange = (val: string) => {
    setLocalPrice(val);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      const num = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
      onUpdate(product._id, { price: num });
    }, 150);
  };

  const handleStockChange = (val: string) => {
    setLocalStock(val);
    if (stockDebounceRef.current) clearTimeout(stockDebounceRef.current);
    stockDebounceRef.current = setTimeout(() => {
      const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      onUpdate(product._id, { stock: num });
    }, 150);
  };

  const handleOrderQtyChange = (val: string) => {
    setLocalOrderQty(val);
    if (orderDebounceRef.current) clearTimeout(orderDebounceRef.current);
    orderDebounceRef.current = setTimeout(() => {
      const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      onUserOrderQtyChange(product._id, num);
    }, 100); // Quick sync for instant Grand Total update
  };

  // Immediate Stepper Controls
  const handleAdminStockDelta = (delta: number) => {
    const current = parseInt(localStock, 10) || 0;
    const nextVal = Math.max(0, current + delta);
    setLocalStock(nextVal === 0 ? '' : String(nextVal));
    if (stockDebounceRef.current) clearTimeout(stockDebounceRef.current);
    onUpdate(product._id, { stock: nextVal });
  };

  const handleUserOrderDelta = (delta: number) => {
    const current = parseInt(localOrderQty, 10) || 0;
    const nextVal = Math.max(0, current + delta);
    setLocalOrderQty(nextVal === 0 ? '' : String(nextVal));
    if (orderDebounceRef.current) clearTimeout(orderDebounceRef.current);
    onUserOrderQtyChange(product._id, nextVal);
  };

  // Live Calculations (Instant display from local inputs)
  const currentPrice = parseFloat(localPrice) || 0;
  const currentStock = parseInt(localStock, 10) || 0;
  const currentOrder = parseInt(localOrderQty, 10) || 0;

  const rowAmount = isAdmin 
    ? currentPrice * currentStock 
    : currentPrice * currentOrder;

  return (
    <tr className={`border-b border-slate-200 transition-colors group ${
      !isAdmin && currentOrder > 0 ? 'bg-indigo-50/50 hover:bg-indigo-50/80' : 'hover:bg-slate-50/70'
    }`}>
      {/* 1. Sticky Serial Number Column */}
      <td className="py-2 px-1.5 sm:px-2.5 text-center text-xs font-bold text-slate-500 bg-white/95 sticky left-0 z-10 border-r border-slate-200 shadow-xs w-9 sm:w-12 select-none">
        {product.serialNumber}
      </td>

      {/* 2. Product Name */}
      <td className="py-1.5 px-1.5 sm:px-3 min-w-[130px] sm:min-w-[200px]">
        {isAdmin ? (
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => onUpdate(product._id, { name: localName })}
            placeholder="Product Name..."
            className="w-full px-2 py-1 text-xs sm:text-sm font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all placeholder-slate-400"
          />
        ) : (
          <div className="py-1 px-1.5">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate max-w-[160px] sm:max-w-none">
              {product.name || 'Untitled Product'}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-500">
              {currency}{currentPrice.toLocaleString()}
            </span>
          </div>
        )}
      </td>

      {/* 3. Price Column */}
      <td className="py-1.5 px-1 sm:px-2.5 w-20 sm:w-28 text-right">
        {isAdmin ? (
          <div className="relative flex items-center justify-end">
            <span className="text-[10px] sm:text-xs text-slate-400 font-semibold mr-1 select-none">
              {currency}
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={localPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              onBlur={() => {
                const num = localPrice === '' ? 0 : Math.max(0, parseFloat(localPrice) || 0);
                onUpdate(product._id, { price: num });
              }}
              placeholder="0"
              className="w-14 sm:w-20 text-right px-1.5 py-1 text-xs sm:text-sm font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none"
            />
          </div>
        ) : (
          <div className="text-right py-1 pr-1 font-bold text-xs sm:text-sm text-slate-800">
            {currency}{currentPrice.toLocaleString()}
          </div>
        )}
      </td>

      {/* 4. Warehouse Stock Column */}
      <td className="py-1.5 px-1 sm:px-2.5 w-28 sm:w-36 text-center">
        {isAdmin ? (
          /* Admin Stock Steppers + Input */
          <div className="inline-flex items-center justify-center bg-slate-100/90 rounded-md p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => handleAdminStockDelta(-1)}
              disabled={currentStock <= 0}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="-1"
            >
              <MinusIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={localStock}
              onChange={(e) => handleStockChange(e.target.value)}
              onBlur={() => {
                const num = localStock === '' ? 0 : Math.max(0, parseInt(localStock, 10) || 0);
                onUpdate(product._id, { stock: num });
              }}
              placeholder="0"
              className="w-8 sm:w-11 text-center text-xs sm:text-sm font-bold text-slate-800 bg-transparent focus:bg-white focus:outline-none border-0 rounded py-0.5"
            />
            <button
              type="button"
              onClick={() => handleAdminStockDelta(1)}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded active:bg-slate-200 transition-all cursor-pointer"
              title="+1"
            >
              <PlusIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        ) : (
          /* Normal User Read-Only Stock */
          <div className="flex items-center justify-center">
            {currentStock > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {currentStock} in stock
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Out
              </span>
            )}
          </div>
        )}
      </td>

      {/* 5. Order Quantity Column */}
      <td className="py-1.5 px-1 sm:px-2.5 w-28 sm:w-36 text-center">
        {isAdmin ? (
          <div className="text-center text-[10px] sm:text-xs font-medium text-slate-400">
            {product.orderQuantity ? `${product.orderQuantity} target` : '—'}
          </div>
        ) : (
          /* Normal User Order Steppers */
          <div className="inline-flex items-center justify-center bg-indigo-50/90 rounded-md p-0.5 border border-indigo-200">
            <button
              type="button"
              onClick={() => handleUserOrderDelta(-1)}
              disabled={currentOrder <= 0}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-indigo-800 hover:bg-white rounded active:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="-1"
            >
              <MinusIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={localOrderQty}
              onChange={(e) => handleOrderQtyChange(e.target.value)}
              onBlur={() => {
                const num = localOrderQty === '' ? 0 : Math.max(0, parseInt(localOrderQty, 10) || 0);
                onUserOrderQtyChange(product._id, num);
              }}
              placeholder="0"
              className="w-8 sm:w-11 text-center text-xs sm:text-sm font-extrabold text-indigo-950 bg-transparent focus:bg-white focus:outline-none border-0 rounded py-0.5"
            />
            <button
              type="button"
              onClick={() => handleUserOrderDelta(1)}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-indigo-800 hover:bg-white rounded active:bg-indigo-100 transition-all cursor-pointer"
              title="+1"
            >
              <PlusIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        )}
      </td>

      {/* 6. Amount Column */}
      <td className="py-2 px-1.5 sm:px-3 text-right text-xs sm:text-sm font-extrabold w-24 sm:w-32 bg-slate-50/40">
        <span className={!isAdmin && currentOrder > 0 ? 'text-indigo-700 font-black' : 'text-slate-800'}>
          {currency}{rowAmount.toLocaleString()}
        </span>
      </td>

      {/* 7. Actions Column */}
      <td className="py-1.5 px-1 sm:px-2.5 w-24 sm:w-36 text-right">
        {isAdmin ? (
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => onInsertAbove(product.serialNumber)}
              className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
              title="Insert Above"
            >
              <span className="text-[10px] sm:text-xs font-bold">↑+</span>
            </button>

            <button
              type="button"
              onClick={() => onInsertBelow(product.serialNumber)}
              className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
              title="Insert Below"
            >
              <span className="text-[10px] sm:text-xs font-bold">↓+</span>
            </button>

            <button
              type="button"
              disabled={product.serialNumber <= 1}
              onClick={() => onMoveUp(product.serialNumber)}
              className="p-1 text-slate-500 hover:text-slate-900 rounded disabled:opacity-20 cursor-pointer hidden sm:inline-block"
              title="Move Up"
            >
              <ArrowUpIcon className="w-3 h-3" />
            </button>

            <button
              type="button"
              disabled={product.serialNumber >= totalProducts}
              onClick={() => onMoveDown(product.serialNumber)}
              className="p-1 text-slate-500 hover:text-slate-900 rounded disabled:opacity-20 cursor-pointer hidden sm:inline-block"
              title="Move Down"
            >
              <ArrowDownIcon className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteRequest(product)}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
              title="Delete Product"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            {currentOrder > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setLocalOrderQty('');
                  onUserOrderQtyChange(product._id, 0);
                }}
                className="text-[10px] sm:text-xs font-semibold text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Clear
              </button>
            ) : (
              <span className="text-xs text-slate-300 select-none pr-2">—</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
});
