'use client';

import React, { useState } from 'react';
import { 
  PlusIcon, 
  LayersIcon, 
  SaveIcon, 
  DownloadIcon, 
  PrinterIcon, 
  CheckIcon, 
  RefreshIcon, 
  StoreIcon, 
  EditIcon,
  ShoppingCartIcon,
  TrashIcon
} from './icons';
import { SaveStatus, InvoiceMeta, UserRole } from '@/types/product';
import { RoleSwitcher } from './RoleSwitcher';

interface InventoryHeaderProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  meta: InvoiceMeta;
  onMetaChange: (meta: Partial<InvoiceMeta>) => void;
  saveStatus: SaveStatus;
  onManualSave: () => void;
  onAddProduct: () => void;
  onOpenBatchModal: () => void;
  onOpenInsertModal: () => void;
  onDownloadPdf: () => void;
  onPrintSheet: () => void;
  totalProducts: number;
  // User mode specific props
  userOrderCount: number;
  userGrandTotal: number;
  onPlaceOrder: () => void;
  onClearOrder: () => void;
}

export function InventoryHeader({
  role,
  onRoleChange,
  meta,
  onMetaChange,
  saveStatus,
  onManualSave,
  onAddProduct,
  onOpenBatchModal,
  onOpenInsertModal,
  onDownloadPdf,
  onPrintSheet,
  totalProducts,
  userOrderCount,
  userGrandTotal,
  onPlaceOrder,
  onClearOrder,
}: InventoryHeaderProps) {
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [tempShopName, setTempShopName] = useState(meta.shopName);

  const handleSaveShopName = () => {
    onMetaChange({ shopName: tempShopName.trim() || 'MY INVENTORY STORE' });
    setIsEditingShop(false);
  };

  const isAdmin = role === 'admin';

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner indicating current role mode */}
      <div className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors ${
        isAdmin 
          ? 'bg-amber-50 text-amber-900 border-b border-amber-200' 
          : 'bg-indigo-50 text-indigo-900 border-b border-indigo-200'
      }`}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{isAdmin ? '👑' : '👤'}</span>
            <span>
              {isAdmin 
                ? 'ADMIN MODE — Full Access: Add/edit products, stock, prices, and inventory controls' 
                : 'CUSTOMER ORDER MODE — Read-Only Catalog: Adjust Order Qty to calculate Price × Quantity and place orders'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="opacity-75">Switch role anytime on the right →</span>
          </div>
        </div>
      </div>

      {/* Main Top Bar: Store Name & Role Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>
            <StoreIcon className="w-5 h-5" />
          </div>

          {isAdmin && isEditingShop ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempShopName}
                onChange={(e) => setTempShopName(e.target.value)}
                className="text-base sm:text-lg font-bold text-slate-900 border border-indigo-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveShopName();
                  if (e.key === 'Escape') setIsEditingShop(false);
                }}
              />
              <button
                onClick={handleSaveShopName}
                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <div 
              className={`group flex items-center gap-2 ${isAdmin ? 'cursor-pointer' : ''}`} 
              onClick={() => { 
                if (isAdmin) {
                  setTempShopName(meta.shopName); 
                  setIsEditingShop(true); 
                }
              }}
            >
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  {meta.shopName}
                  {isAdmin && <EditIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />}
                </h1>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span>{isAdmin ? 'INVENTORY MANAGEMENT SHEET' : 'PRODUCT ORDER SHEET'}</span>
                  <span>•</span>
                  <span>{meta.date}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Area: Status & Role Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Admin Auto-Save Status */}
          {isAdmin && (
            <div className="text-xs flex items-center gap-1.5 px-3 py-1 rounded-full border">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border-amber-200">
                  <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border-emerald-200">
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Saved ✓</span>
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-slate-600 bg-slate-100 border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Unsaved changes</span>
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Save failed</span>
                </span>
              )}
            </div>
          )}

          {/* Role Switcher */}
          <RoleSwitcher currentRole={role} onRoleChange={onRoleChange} />
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Role-Specific Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            /* ADMIN CONTROLS */
            <>
              <button
                type="button"
                onClick={onAddProduct}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs shadow-amber-200 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>

              <button
                type="button"
                onClick={onOpenBatchModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Add many product names at once"
              >
                <LayersIcon className="w-4 h-4 text-amber-600" />
                <span>Add Many Quickly</span>
              </button>

              <button
                type="button"
                onClick={onOpenInsertModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Insert a product at any serial number"
              >
                <span className="text-xs font-bold text-slate-500">#</span>
                <span className="hidden sm:inline">Insert at Serial</span>
              </button>

              <button
                type="button"
                onClick={onManualSave}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <SaveIcon className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            /* NORMAL USER CONTROLS */
            <>
              <button
                type="button"
                disabled={userOrderCount === 0}
                onClick={onPlaceOrder}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs shadow-indigo-200 transition-all cursor-pointer"
              >
                <ShoppingCartIcon className="w-4 h-4" />
                <span>Place Order {userOrderCount > 0 ? `(${userOrderCount} items • ${meta.currency}${userGrandTotal.toLocaleString()})` : ''}</span>
              </button>

              {userOrderCount > 0 && (
                <button
                  type="button"
                  onClick={onClearOrder}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Clear all ordered quantities"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span>Clear Quantities</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right Side: Print & Download Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrintSheet}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Print sheet directly"
          >
            <PrinterIcon className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            title={isAdmin ? "Download Inventory Report" : "Download Order Sheet / Invoice"}
          >
            <DownloadIcon className="w-4 h-4" />
            <span>{isAdmin ? 'Download Inventory' : 'Download Order Invoice'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
