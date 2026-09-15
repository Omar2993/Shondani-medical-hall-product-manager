'use client';

import React, { useRef } from 'react';
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
  // User's dedicated order quantity for this product
  userOrderQty: number;
  onUserOrderQtyChange: (productId: string, newQty: number) => void;
  // Admin handlers
  onUpdate: (id: string, updates: Partial<Product>) => void;
  onInsertAbove: (serialNumber: number) => void;
  onInsertBelow: (serialNumber: number) => void;
  onMoveUp: (serialNumber: number) => void;
  onMoveDown: (serialNumber: number) => void;
  onDeleteRequest: (product: Product) => void;
}

export function InventoryRow({
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = role === 'admin';

  // Amount calculation:
  // Admin: Price × Stock (Inventory Asset Value)
  // User: Price × userOrderQty (Item Order Total)
  const itemPrice = product.price || 0;
  const adminStock = product.stock || 0;
  const rowAmount = isAdmin 
    ? itemPrice * adminStock 
    : itemPrice * userOrderQty;

  // Admin Stock Steppers
  const handleAdminStockChange = (delta: number) => {
    const nextVal = Math.max(0, adminStock + delta);
    onUpdate(product._id, { stock: nextVal });
  };

  // User Order Steppers
  const handleUserOrderChange = (delta: number) => {
    const nextVal = Math.max(0, userOrderQty + delta);
    onUserOrderQtyChange(product._id, nextVal);
  };

  return (
    <tr className={`border-b border-slate-200 transition-colors group ${
      !isAdmin && userOrderQty > 0 ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'
    }`}>
      {/* 1. Serial Number */}
      <td className="py-2.5 px-3 text-center text-xs font-bold text-slate-500 bg-slate-50/50 w-12 select-none">
        {product.serialNumber}
      </td>

      {/* 2. Product Name */}
      <td className="py-2 px-3 min-w-[200px]">
        {isAdmin ? (
          /* Admin Editable Input */
          <input
            ref={nameInputRef}
            type="text"
            value={product.name}
            onChange={(e) => onUpdate(product._id, { name: e.target.value })}
            placeholder="Product Name..."
            className="w-full px-2.5 py-1.5 text-sm font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all placeholder-slate-400"
          />
        ) : (
          /* Normal User Read-Only Name */
          <div className="py-1.5 px-2.5">
            <span className="text-sm font-bold text-slate-900 block">{product.name || 'Untitled Product'}</span>
            <span className="text-[11px] text-slate-500">Unit Price: {currency}{itemPrice.toLocaleString()}</span>
          </div>
        )}
      </td>

      {/* 3. Price */}
      <td className="py-2 px-3 w-28">
        {isAdmin ? (
          /* Admin Editable Price */
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-xs text-slate-400 font-semibold select-none">
              {currency}
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={product.price === 0 ? '' : product.price}
              onChange={(e) => {
                const val = e.target.value;
                const numeric = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
                onUpdate(product._id, { price: numeric });
              }}
              placeholder="0"
              className="w-full pl-6 pr-2 py-1.5 text-sm text-right font-semibold text-slate-800 bg-transparent hover:bg-white focus:bg-white rounded border border-transparent hover:border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all placeholder-slate-300"
            />
          </div>
        ) : (
          /* Normal User Read-Only Price */
          <div className="text-right py-1.5 pr-2 font-bold text-sm text-slate-800">
            {currency}{itemPrice.toLocaleString()}
          </div>
        )}
      </td>

      {/* 4. Stock Column */}
      <td className="py-2 px-3 w-36">
        {isAdmin ? (
          /* Admin Stock Steppers + Input */
          <div className="flex items-center justify-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => handleAdminStockChange(-1)}
              disabled={adminStock <= 0}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded active:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Decrease Stock (-1)"
            >
              <MinusIcon className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={adminStock === 0 ? '' : adminStock}
              onChange={(e) => {
                const val = e.target.value;
                const numeric = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                onUpdate(product._id, { stock: numeric });
              }}
              placeholder="0"
              className="w-12 text-center text-sm font-bold text-slate-800 bg-transparent focus:bg-white focus:outline-none border-0 rounded py-0.5"
            />
            <button
              type="button"
              onClick={() => handleAdminStockChange(1)}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded active:bg-slate-200 transition-all cursor-pointer"
              title="Increase Stock (+1)"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* Normal User: Protected Read-Only Stock Indicator */
          <div className="flex items-center justify-center">
            {adminStock > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{adminStock} in stock</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Out of stock</span>
              </span>
            )}
          </div>
        )}
      </td>

      {/* 5. Order Quantity Column */}
      <td className="py-2 px-3 w-36">
        {isAdmin ? (
          /* Admin View of Target / Reorder Benchmark */
          <div className="text-center py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
            {product.orderQuantity ? `${product.orderQuantity} benchmark` : '—'}
          </div>
        ) : (
          /* Normal User Interactive Order Quantity Steppers */
          <div className="flex items-center justify-center bg-indigo-50/80 rounded-lg p-0.5 border border-indigo-200">
            <button
              type="button"
              onClick={() => handleUserOrderChange(-1)}
              disabled={userOrderQty <= 0}
              className="w-7 h-7 flex items-center justify-center text-indigo-700 hover:text-indigo-950 hover:bg-white rounded active:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Decrease Order Quantity (-1)"
            >
              <MinusIcon className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0}
              value={userOrderQty === 0 ? '' : userOrderQty}
              onChange={(e) => {
                const val = e.target.value;
                const numeric = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
                onUserOrderQtyChange(product._id, numeric);
              }}
              placeholder="0"
              className="w-12 text-center text-sm font-extrabold text-indigo-950 bg-transparent focus:bg-white focus:outline-none border-0 rounded py-0.5"
            />
            <button
              type="button"
              onClick={() => handleUserOrderChange(1)}
              className="w-7 h-7 flex items-center justify-center text-indigo-700 hover:text-indigo-950 hover:bg-white rounded active:bg-indigo-100 transition-all cursor-pointer"
              title="Increase Order Quantity (+1)"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>

      {/* 6. Amount Column */}
      <td className="py-2.5 px-3 text-right text-sm font-extrabold w-32 bg-slate-50/40">
        <span className={!isAdmin && userOrderQty > 0 ? 'text-indigo-700 font-black' : 'text-slate-800'}>
          {currency}{rowAmount.toLocaleString()}
        </span>
      </td>

      {/* 7. Actions Column */}
      <td className="py-2 px-3 w-40 text-right">
        {isAdmin ? (
          /* Admin Management Controls */
          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onInsertAbove(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
              title="Insert Product Above"
            >
              <span className="text-[11px] font-bold">↑+</span>
            </button>

            <button
              type="button"
              onClick={() => onInsertBelow(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
              title="Insert Product Below"
            >
              <span className="text-[11px] font-bold">↓+</span>
            </button>

            <button
              type="button"
              disabled={product.serialNumber <= 1}
              onClick={() => onMoveUp(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Move Up"
            >
              <ArrowUpIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={product.serialNumber >= totalProducts}
              onClick={() => onMoveDown(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Move Down"
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteRequest(product)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer ml-1"
              title="Delete Row"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Normal User: Clear individual item button if quantity > 0 */
          <div className="flex items-center justify-end">
            {userOrderQty > 0 ? (
              <button
                type="button"
                onClick={() => onUserOrderQtyChange(product._id, 0)}
                className="text-[11px] font-semibold text-slate-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                title="Remove from Order"
              >
                Reset
              </button>
            ) : (
              <span className="text-xs text-slate-300 select-none">—</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
