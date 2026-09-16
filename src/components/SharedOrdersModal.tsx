'use client';

import React, { useState } from 'react';
import { CustomerOrder, InvoiceMeta } from '@/types/product';
import { XIcon, DownloadIcon, ReceiptIcon, SearchIcon, ArrowDownIcon, ArrowUpIcon } from './icons';
import { generateSharedOrderPdf } from '@/utils/invoicePdfGenerator';

interface SharedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: CustomerOrder[];
  meta: InvoiceMeta;
}

export function SharedOrdersModal({
  isOpen,
  onClose,
  orders,
  meta,
}: SharedOrdersModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      o.orderId.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.items.some((item) => item.productName.toLowerCase().includes(q))
    );
  });

  const handleDownloadInvoice = (order: CustomerOrder) => {
    generateSharedOrderPdf(order, meta, true);
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-indigo-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <ReceiptIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Shared Orders & Invoices
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {orders.length} total
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Central database history • Any device can view & download invoices
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, customer, or product name..."
            className="w-full text-xs sm:text-sm bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Orders List Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ReceiptIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No orders found</p>
              <p className="text-xs text-slate-400 mt-1">
                {orders.length === 0
                  ? 'No orders have been submitted yet. Place an order on any device to see it appear here instantly.'
                  : 'No orders match your search query.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.orderId;
              const totalUnits = order.items.reduce((sum, it) => sum + (it.orderedQuantity || 0), 0);

              return (
                <div
                  key={order.orderId}
                  className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-indigo-300 transition-colors bg-white"
                >
                  {/* Order Summary Row */}
                  <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-indigo-900">
                          {order.orderId}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          • {order.date}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                        <span className="font-medium">{order.customerName}</span>
                        <span>•</span>
                        <span>{order.items.length} product{order.items.length === 1 ? '' : 's'} ({totalUnits} units)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-right">
                        <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Total Amount
                        </div>
                        <div className="text-sm sm:text-base font-black text-indigo-700">
                          {meta.currency}{order.grandTotal.toLocaleString()}
                        </div>
                      </div>

                      {/* Download Invoice Button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                        title="Download official PDF invoice for this order"
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download Invoice</span>
                        <span className="sm:hidden">Invoice</span>
                      </button>

                      {/* Expand / Collapse Details Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(order.orderId)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                        title={isExpanded ? 'Hide items' : 'Show items'}
                      >
                        {isExpanded ? (
                          <ArrowUpIcon className="w-4 h-4" />
                        ) : (
                          <ArrowDownIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Items Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-white p-3 sm:p-4 text-xs">
                      <div className="font-bold text-[11px] text-slate-500 uppercase tracking-wider mb-2">
                        Order Items Breakdown
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                            <th className="py-1">Product</th>
                            <th className="py-1 text-right">Unit Price</th>
                            <th className="py-1 text-center">Ordered Qty</th>
                            <th className="py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {order.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-1.5 font-medium text-slate-800">{item.productName}</td>
                              <td className="py-1.5 text-right text-slate-600">{meta.currency}{item.price.toLocaleString()}</td>
                              <td className="py-1.5 text-center font-bold text-slate-900">{item.orderedQuantity}</td>
                              <td className="py-1.5 text-right font-bold text-indigo-700">
                                {meta.currency}{(item.price * item.orderedQuantity).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 font-bold">
                            <td colSpan={3} className="py-2 text-right text-slate-700 uppercase">Grand Total:</td>
                            <td className="py-2 text-right font-black text-indigo-900">
                              {meta.currency}{order.grandTotal.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time connected to central SQLite database</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
