'use client';

import React from 'react';
import { Product, InvoiceMeta, UserRole } from '@/types/product';

interface PrintableInvoiceProps {
  products: Product[];
  meta: InvoiceMeta;
  role: UserRole;
  userOrders: Record<string, number>;
  userGrandTotal: number;
  adminGrandTotal: number;
  totalAdminStock: number;
  totalUserOrderedUnits: number;
}

export function PrintableInvoice({
  products,
  meta,
  role,
  userOrders,
  userGrandTotal: _userGrandTotal,
  adminGrandTotal,
  totalAdminStock,
  totalUserOrderedUnits: _totalUserOrderedUnits,
}: PrintableInvoiceProps) {
  const isAdmin = role === 'admin';

  // For users, strictly show only items with orderQuantity > 0. Never fallback to all products.
  const displayProducts = isAdmin
    ? products
    : products.filter(p => (userOrders[p._id] || 0) > 0);

  // Compute live accurate totals based only on displayed products
  const currentTotalUnits = isAdmin 
    ? totalAdminStock 
    : displayProducts.reduce((sum, p) => sum + (userOrders[p._id] || 0), 0);

  const currentGrandTotal = isAdmin 
    ? adminGrandTotal 
    : displayProducts.reduce((sum, p) => sum + (p.price || 0) * (userOrders[p._id] || 0), 0);

  if (displayProducts.length === 0) {
    return (
      <div className="hidden print:block bg-white text-black font-sans w-full max-w-[210mm] mx-auto p-12 text-center">
        <h2 className="text-xl font-bold text-slate-900">No products to invoice</h2>
        <p className="text-xs text-slate-500 mt-2">
          {isAdmin 
            ? 'No inventory items available to generate report.' 
            : 'Please select an order quantity greater than 0 for at least one product.'}
        </p>
      </div>
    );
  }

  return (
    <div className="hidden print:block bg-white text-black font-sans w-full max-w-[210mm] mx-auto p-4 sm:p-6">
      {/* Printable Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            {meta.shopName || 'INVENTORY / INVOICE'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-bold">
            {isAdmin ? 'OFFICIAL INVENTORY & STOCK VALUATION REPORT' : 'CUSTOMER ORDER INVOICE / PURCHASE BILL'}
          </p>
          {meta.address && <p className="text-xs text-slate-500 mt-0.5">{meta.address}</p>}
          {meta.phone && <p className="text-xs text-slate-500 mt-0.5">Contact: {meta.phone}</p>}
        </div>

        <div className="text-right">
          <div className="inline-block bg-slate-100 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800">
            <p className="font-bold">{isAdmin ? 'INVENTORY STATEMENT' : 'INVOICE'} #{meta.invoiceNumber || 'INV-001'}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Date: {meta.date}</p>
          </div>
        </div>
      </div>

      {/* Summary Metric Chips */}
      <div className="grid grid-cols-3 gap-4 mb-5 p-3 bg-slate-50 border border-slate-200 rounded text-center text-xs">
        <div>
          <span className="text-slate-500 block font-medium">
            {isAdmin ? 'TOTAL PRODUCTS' : 'ORDERED ITEMS'}
          </span>
          <span className="text-base font-bold text-slate-900">
            {displayProducts.length}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium">
            {isAdmin ? 'TOTAL WAREHOUSE UNITS' : 'TOTAL UNITS ORDERED'}
          </span>
          <span className="text-base font-bold text-slate-900">
            {currentTotalUnits.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium">
            {isAdmin ? 'TOTAL INVENTORY VALUE' : 'ORDER GRAND TOTAL'}
          </span>
          <span className="text-base font-black text-slate-900">
            {meta.currency}{currentGrandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Table: Natural flowing table with table-fixed and break-inside-avoid */}
      <table className="w-full border-collapse text-xs border border-slate-300 table-fixed">
        <thead className="table-header-group">
          <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-left">
            <th className="py-2 px-2 text-center w-12 border-r border-slate-300">#</th>
            <th className="py-2 px-3 border-r border-slate-300">Product Name</th>
            <th className="py-2 px-3 text-right w-24 border-r border-slate-300">Price ({meta.currency})</th>
            <th className="py-2 px-3 text-center w-20 border-r border-slate-300">
              {isAdmin ? 'Stock' : 'Ordered Qty'}
            </th>
            <th className="py-2 px-3 text-right w-28">
              {isAdmin ? `Stock Value (${meta.currency})` : `Item Total (${meta.currency})`}
            </th>
          </tr>
        </thead>
        <tbody>
          {displayProducts.map((p, idx) => {
            const price = p.price || 0;
            const quantity = isAdmin ? (p.stock || 0) : (userOrders[p._id] || 0);
            const amount = price * quantity;

            return (
              <tr 
                key={p._id} 
                className="border-b border-slate-200 break-inside-avoid page-break-inside-avoid"
              >
                <td className="py-1.5 px-2 text-center font-bold text-slate-600 border-r border-slate-200">
                  {idx + 1}
                </td>
                <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200 break-words whitespace-normal leading-snug">
                  {p.name || 'Untitled Product'}
                </td>
                <td className="py-1.5 px-3 text-right text-slate-700 border-r border-slate-200">
                  {price.toLocaleString()}
                </td>
                <td className="py-1.5 px-3 text-center font-bold text-slate-800 border-r border-slate-200">
                  {quantity.toLocaleString()}
                </td>
                <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                  {amount.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="table-footer-group">
          <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900 break-inside-avoid">
            <td colSpan={2} className="py-2.5 px-3 text-right text-xs uppercase tracking-wider">
              {isAdmin ? 'Total Inventory Value:' : 'Order Grand Total:'}
            </td>
            <td className="py-2.5 px-3 text-right text-xs">
              {meta.currency}
            </td>
            <td className="py-2.5 px-3 text-center text-xs">
              {currentTotalUnits.toLocaleString()} units
            </td>
            <td className="py-2.5 px-3 text-right text-sm font-black text-slate-950">
              {meta.currency}{currentGrandTotal.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Invoice Footer / Signatures */}
      <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500 break-inside-avoid">
        <div>
          <p>Generated automatically via Business Manager System</p>
          <p className="text-[10px] mt-0.5">Printed on: {new Date().toLocaleString()}</p>
        </div>
        <div className="text-center w-44">
          <div className="border-b border-slate-400 mb-1 w-full"></div>
          <p className="font-semibold text-slate-700">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}
