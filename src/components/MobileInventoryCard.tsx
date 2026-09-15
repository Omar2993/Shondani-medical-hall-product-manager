'use client';

import React, { useState } from 'react';
import { Product, UserRole } from '@/types/product';
import { 
  PlusIcon, 
  MinusIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  EditIcon
} from './icons';

interface MobileInventoryCardProps {
  product: Product;
  totalProducts: number;
  role: UserRole;
  currency?: string;
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

export function MobileInventoryCard({
  product,
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
}: MobileInventoryCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const isAdmin = role === 'admin';

  const itemPrice = product.price || 0;
  const adminStock = product.stock || 0;

  // Amount calculation:
  // Admin: Price × Stock
  // User: Price × userOrderQty
  const amount = isAdmin 
    ? itemPrice * adminStock 
    : itemPrice * userOrderQty;

  const handleAdminStockChange = (delta: number) => {
    const nextVal = Math.max(0, adminStock + delta);
    onUpdate(product._id, { stock: nextVal });
  };

  const handleUserOrderChange = (delta: number) => {
    const nextVal = Math.max(0, userOrderQty + delta);
    onUserOrderQtyChange(product._id, nextVal);
  };

  return (
    <div className={`rounded-xl border shadow-xs p-4 space-y-3 transition-all ${
      !isAdmin && userOrderQty > 0 ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200'
    }`}>
      {/* Header: Serial & Name */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 flex-1">
          <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold shrink-0 ${
            isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
          }`}>
            #{product.serialNumber}
          </span>

          {isAdmin ? (
            isEditingName ? (
              <input
                type="text"
                value={product.name}
                onChange={(e) => onUpdate(product._id, { name: e.target.value })}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false); }}
                autoFocus
                className="w-full text-sm font-semibold text-slate-900 border border-amber-500 rounded px-2 py-1 focus:outline-none"
              />
            ) : (
              <h3 
                onClick={() => setIsEditingName(true)}
                className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 cursor-pointer hover:text-amber-700 transition-colors flex-1"
              >
                <span>{product.name || 'Untitled Product'}</span>
                <EditIcon className="w-3 h-3 text-slate-400 shrink-0" />
              </h3>
            )
          ) : (
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {product.name || 'Untitled Product'}
              </h3>
              <p className="text-[11px] text-slate-500">Unit Price: {currency}{itemPrice.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Delete button (Admin only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onDeleteRequest(product)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Delete product"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid: Price, Stock, Order Qty, Amount */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Price Box */}
        <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Price
          </label>
          <div className="relative flex items-center">
            <span className="text-xs font-bold text-slate-400 mr-1 select-none">
              {currency}
            </span>
            {isAdmin ? (
              <input
                type="number"
                min={0}
                step="any"
                value={product.price === 0 ? '' : product.price}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate(product._id, { price: val === '' ? 0 : Math.max(0, parseFloat(val) || 0) });
                }}
                placeholder="0"
                className="w-full text-sm font-bold text-slate-800 bg-transparent focus:outline-none"
              />
            ) : (
              <span className="text-sm font-bold text-slate-900">
                {itemPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Amount Box */}
        <div className={`p-2.5 rounded-lg border ${
          !isAdmin && userOrderQty > 0 ? 'bg-indigo-100/60 border-indigo-200' : 'bg-slate-50 border-slate-100'
        }`}>
          <label className="block text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">
            {isAdmin ? 'Stock Value' : 'Item Total'}
          </label>
          <p className="text-sm font-extrabold text-indigo-950">
            {currency}{amount.toLocaleString()}
          </p>
        </div>

        {/* Stock Box */}
        <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Warehouse Stock
          </label>
          {isAdmin ? (
            <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => handleAdminStockChange(-1)}
                disabled={adminStock <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={0}
                value={adminStock === 0 ? '' : adminStock}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate(product._id, { stock: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) });
                }}
                placeholder="0"
                className="w-10 text-center text-sm font-bold text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAdminStockChange(1)}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="py-2 text-xs font-semibold">
              {adminStock > 0 ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  {adminStock} available
                </span>
              ) : (
                <span className="text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                  Out of stock
                </span>
              )}
            </div>
          )}
        </div>

        {/* Order Quantity Box */}
        <div className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100">
          <label className="block text-[11px] font-semibold text-indigo-800 uppercase tracking-wider mb-1.5">
            {isAdmin ? 'Order Benchmark' : 'Your Order Qty'}
          </label>
          {isAdmin ? (
            <div className="py-2 text-center text-xs font-semibold text-slate-500">
              {product.orderQuantity || 0} units
            </div>
          ) : (
            <div className="flex items-center justify-between bg-white rounded-lg border border-indigo-200 p-1">
              <button
                type="button"
                onClick={() => handleUserOrderChange(-1)}
                disabled={userOrderQty <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={0}
                value={userOrderQty === 0 ? '' : userOrderQty}
                onChange={(e) => {
                  const val = e.target.value;
                  onUserOrderQtyChange(product._id, val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                }}
                placeholder="0"
                className="w-10 text-center text-sm font-black text-indigo-950 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleUserOrderChange(1)}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-900 cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Row Actions */}
      {isAdmin && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onInsertAbove(product.serialNumber)}
              className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-md font-medium transition-colors cursor-pointer"
            >
              + Insert Above
            </button>
            <button
              type="button"
              onClick={() => onInsertBelow(product.serialNumber)}
              className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-md font-medium transition-colors cursor-pointer"
            >
              + Insert Below
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={product.serialNumber <= 1}
              onClick={() => onMoveUp(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer"
              title="Move Up"
            >
              <ArrowUpIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={product.serialNumber >= totalProducts}
              onClick={() => onMoveDown(product.serialNumber)}
              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer"
              title="Move Down"
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
