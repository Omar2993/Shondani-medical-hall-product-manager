'use client';

import React, { useState } from 'react';
import { XIcon, PlusIcon } from './icons';

interface InsertAtSerialModalProps {
  isOpen: boolean;
  maxSerial: number;
  onClose: () => void;
  onInsert: (targetSerial: number, name: string, price?: number, stock?: number, orderQty?: number) => void;
}

export function InsertAtSerialModal({
  isOpen,
  maxSerial,
  onClose,
  onInsert,
}: InsertAtSerialModalProps) {
  const [serial, setSerial] = useState<number>(1);
  const [name, setName] = useState('');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('');
  const [orderQty, setOrderQty] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedSerial = Math.max(1, Math.min(serial, maxSerial + 1));
    const parsedPrice = price === '' ? 0 : Math.max(0, parseFloat(price) || 0);
    const parsedStock = stock === '' ? 0 : Math.max(0, parseInt(stock, 10) || 0);
    const parsedOrder = orderQty === '' ? 0 : Math.max(0, parseInt(orderQty, 10) || 0);

    onInsert(parsedSerial, name.trim(), parsedPrice, parsedStock, parsedOrder);
    setName('');
    setPrice('');
    setStock('');
    setOrderQty('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Insert Product at Position</h3>
            <p className="text-xs text-slate-500">Insert a product at any specific serial number</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Serial Number Position (1 to {maxSerial + 1})
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-lg border border-slate-200">
                  #
                </span>
                <input
                  type="number"
                  min={1}
                  max={maxSerial + 1}
                  value={serial}
                  onChange={(e) => setSerial(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Products from position #{serial} and onward will move down automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sterile Gauze 4x4"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Price (৳)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Order Qty
                </label>
                <input
                  type="number"
                  min={0}
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs shadow-indigo-200 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Insert Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
