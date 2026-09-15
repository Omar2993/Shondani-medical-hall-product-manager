'use client';

import React from 'react';
import { CheckIcon, XIcon, DownloadIcon } from './icons';

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderId: string;
  customerName: string;
  items: Array<{ name: string; price: number; quantity: number; amount: number }>;
  grandTotal: number;
  currency?: string;
  onClose: () => void;
  onDownloadInvoice: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderId,
  customerName,
  items,
  grandTotal,
  currency = '৳',
  onClose,
  onDownloadInvoice,
}: OrderSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 text-center border-b border-slate-100 bg-emerald-50/50">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Order Placed Successfully!</h3>
          <p className="text-xs text-slate-600 mt-1">
            Order Reference: <span className="font-bold text-slate-800">{orderId}</span>
          </p>
        </div>

        <div className="p-6 max-h-72 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider border-b pb-2">
            <span>Ordered Items ({items.length})</span>
            <span>Subtotal</span>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
              <div>
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} × {currency}{item.price.toLocaleString()}
                </p>
              </div>
              <p className="font-extrabold text-slate-900">
                {currency}{item.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Grand Total:</span>
            <p className="text-xl font-black text-indigo-700">
              {currency}{grandTotal.toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadInvoice}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Download Invoice</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
