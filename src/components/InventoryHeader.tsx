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
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
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
  userOrderCount: number;
  userGrandTotal: number;
  onPlaceOrder: () => void;
  onClearOrder: () => void;
}

export function InventoryHeader({
  role,
  onRoleChange,
  onOpenAdminLogin,
  onLogoutAdmin,
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
    onMetaChange({ shopName: tempShopName.trim() || 'Shondani Medical Hall' });
    setIsEditingShop(false);
  };

  const isAdmin = role === 'admin';

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner */}
      <div className={`px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold flex items-center justify-between transition-colors ${
        isAdmin 
          ? 'bg-amber-50 text-amber-900 border-b border-amber-200' 
          : 'bg-indigo-50 text-indigo-900 border-b border-indigo-200'
      }`}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 truncate">
            <span>{isAdmin ? '👑' : '👤'}</span>
            <span className="truncate">
              {isAdmin 
                ? 'ADMINISTRATOR (omar): Full inventory management & product controls active' 
                : 'CUSTOMER MODE: View Shondani catalog, set Order Qty, and submit orders'}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="opacity-70">Shondani Medical Hall</span>
          </div>
        </div>
      </div>

      {/* Main Top Bar: Store Name & Role Switcher */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-2 sm:p-2.5 rounded-xl ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>
            <StoreIcon className="w-5 h-5" />
          </div>

          {isAdmin && isEditingShop ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempShopName}
                onChange={(e) => setTempShopName(e.target.value)}
                className="text-sm sm:text-lg font-bold text-slate-900 border border-indigo-400 rounded-md px-2 py-1 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveShopName();
                  if (e.key === 'Escape') setIsEditingShop(false);
                }}
              />
              <button
                onClick={handleSaveShopName}
                className="px-2 py-1 text-xs font-bold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <div 
              className={`group flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer' : ''}`} 
              onClick={() => { 
                if (isAdmin) {
                  setTempShopName(meta.shopName); 
                  setIsEditingShop(true); 
                }
              }}
            >
              <div>
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  {meta.shopName}
                  {isAdmin && <EditIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="font-semibold">{isAdmin ? 'INVENTORY LEDGER' : 'ORDER SHEET'}</span>
                  <span>•</span>
                  <span>{meta.date}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Area: Status & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin && (
            <div className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-700">
                  <RefreshIcon className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckIcon className="w-3 h-3" />
                  <span>Saved ✓</span>
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="hidden sm:inline">Unsaved</span>
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-700">
                  <span>Save failed</span>
                </span>
              )}
            </div>
          )}

          {/* Role Switcher */}
          <RoleSwitcher
            currentRole={role}
            onRoleChange={onRoleChange}
            onOpenAdminLogin={onOpenAdminLogin}
            onLogoutAdmin={onLogoutAdmin}
          />
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Role Actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {isAdmin ? (
            /* ADMIN CONTROLS */
            <>
              <button
                type="button"
                onClick={onAddProduct}
                className="flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>

              <button
                type="button"
                onClick={onOpenBatchModal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Add many product names at once"
              >
                <LayersIcon className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Add Many Quickly</span>
                <span className="sm:hidden">Batch</span>
              </button>

              <button
                type="button"
                onClick={onOpenInsertModal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Insert product at specific serial"
              >
                <span className="font-bold text-xs">#</span>
                <span className="hidden sm:inline">Insert at Serial</span>
              </button>

              <button
                type="button"
                onClick={onManualSave}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <SaveIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Changes</span>
              </button>
            </>
          ) : (
            /* NORMAL USER CONTROLS */
            <>
              <button
                type="button"
                disabled={userOrderCount === 0}
                onClick={onPlaceOrder}
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <ShoppingCartIcon className="w-4 h-4" />
                <span>
                  Place Order {userOrderCount > 0 ? `(${userOrderCount} items • ${meta.currency}${userGrandTotal.toLocaleString()})` : ''}
                </span>
              </button>

              {userOrderCount > 0 && (
                <button
                  type="button"
                  onClick={onClearOrder}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Clear all ordered quantities"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Order</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Print & PDF Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrintSheet}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Print"
          >
            <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Download Invoice"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Download Report' : 'Download Invoice'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
