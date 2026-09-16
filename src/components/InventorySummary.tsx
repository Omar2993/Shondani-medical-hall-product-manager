'use client';

import React from 'react';
import { PackageIcon, ShoppingCartIcon, AlertCircleIcon } from './icons';
import { UserRole, AdminInventoryStats, UserOrderStats } from '@/types/product';

interface InventorySummaryProps {
  role: UserRole;
  adminStats: AdminInventoryStats;
  userStats: UserOrderStats;
  currency?: string;
}

export function InventorySummary({
  role,
  adminStats,
  userStats,
  currency = '৳',
}: InventorySummaryProps) {
  const isAdmin = role === 'admin';

  const formattedAdminValue = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(adminStats.totalInventoryValue);

  const formattedUserGrandTotal = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(userStats.grandTotal);

  if (isAdmin) {
    /* ADMIN INVENTORY METRICS */
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5">
        {/* Total Products */}
        <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
            <p className="mt-0.5 text-base sm:text-lg font-bold text-slate-800">
              {adminStats.totalProducts}
            </p>
            <p className="text-[10px] text-slate-400">Catalog items</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-lg">
            <PackageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Total Warehouse Stock */}
        <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Warehouse Stock</p>
            <p className="mt-0.5 text-base sm:text-lg font-bold text-emerald-700">
              {adminStats.totalStock.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Total in warehouse</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <span className="text-base sm:text-lg">📦</span>
          </div>
        </div>

        {/* Out of Stock Count */}
        <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Alerts</p>
            <p className={`mt-0.5 text-base sm:text-lg font-bold ${adminStats.outOfStockCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {adminStats.outOfStockCount}
            </p>
            <p className="text-[10px] text-slate-400">
              {adminStats.outOfStockCount > 0 ? 'Out of stock' : 'All items in stock'}
            </p>
          </div>
          <div className={`p-1.5 sm:p-2 rounded-lg ${adminStats.outOfStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
            <AlertCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Inventory Stock Value */}
        <div className="bg-gradient-to-br from-amber-700 to-amber-900 text-white p-2 sm:p-2.5 rounded-lg shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-amber-200 uppercase tracking-wider">Inventory Value</p>
            <p className="mt-0.5 text-base sm:text-lg font-extrabold text-white tracking-tight">
              {currency}{formattedAdminValue}
            </p>
            <p className="text-[10px] text-amber-200">Σ(Price × Stock)</p>
          </div>
          <div className="p-1.5 sm:p-2 bg-white/10 text-white rounded-lg backdrop-blur-xs">
            <span className="text-base sm:text-lg font-bold">{currency}</span>
          </div>
        </div>
      </div>
    );
  }

  /* NORMAL USER / CUSTOMER ORDER METRICS */
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5">
      {/* Available Products */}
      <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Catalog Items</p>
          <p className="mt-0.5 text-base sm:text-lg font-bold text-slate-800">
            {userStats.totalProducts}
          </p>
          <p className="text-[10px] text-slate-400">Available products</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-slate-50 text-slate-600 rounded-lg">
          <PackageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Selected Items */}
      <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Items in Order</p>
          <p className="mt-0.5 text-base sm:text-lg font-bold text-indigo-700">
            {userStats.totalOrderedItems}
          </p>
          <p className="text-[10px] text-slate-400">Items selected</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <ShoppingCartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Total Ordered Units */}
      <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units</p>
          <p className="mt-0.5 text-base sm:text-lg font-bold text-emerald-700">
            {userStats.totalOrderedUnits.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">Units in order</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-lg">
          <span className="text-base sm:text-lg font-bold">🛒</span>
        </div>
      </div>

      {/* FIXED GRAND TOTAL: Sum of Price * Ordered Quantity */}
      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white p-2 sm:p-2.5 rounded-lg shadow-sm flex items-center justify-between col-span-2 lg:col-span-1 ring-2 ring-indigo-400/50">
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-1">
            <span>ORDER GRAND TOTAL</span>
          </p>
          <p className="mt-0.5 text-base sm:text-lg font-black text-white tracking-tight">
            {currency}{formattedUserGrandTotal}
          </p>
          <p className="text-[10px] text-indigo-200">Σ(Price × Qty)</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-white/15 text-white rounded-lg backdrop-blur-xs">
          <span className="text-base sm:text-lg font-bold">{currency}</span>
        </div>
      </div>
    </div>
  );
}
