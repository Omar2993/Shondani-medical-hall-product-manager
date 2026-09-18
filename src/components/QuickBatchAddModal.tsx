'use client';

import React, { useState } from 'react';
import { XIcon, LayersIcon, PlusIcon } from './icons';

interface QuickBatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProducts: (names: string[]) => void | Promise<void>;
}

export function QuickBatchAddModal({
  isOpen,
  onClose,
  onAddProducts,
}: QuickBatchAddModalProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const getParsedLines = (rawText: string) => {
    let lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 1 && lines[0].includes(',')) {
      lines = lines[0]
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    }
    return lines;
  };

  const handleAdd = async () => {
    const lines = getParsedLines(text);

    if (lines.length > 0) {
      setIsSubmitting(true);
      try {
        await onAddProducts(lines);
        setText('');
        onClose();
      } catch (err) {
        console.error('Error adding batch products:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const lineCount = getParsedLines(text).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <LayersIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Add Multiple Products Quickly</h3>
              <p className="text-xs text-slate-500">Paste or type product names (one per line)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Product List (1 per line)</span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {lineCount} {lineCount === 1 ? 'product' : 'products'} detected
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full p-3 font-mono text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/40 text-slate-800 placeholder-slate-400"
            placeholder={`Gauze
Thumb Spica
Tennis Elbow Support
Wrist Support
Elbow Support
Knee Support
Anklet
POP
Crape Bandage
Soft Roll`}
          />

          <p className="mt-2 text-xs text-slate-500">
            Tip: You can paste dozens of product names at once. Price, stock, and order quantities can be filled in later directly in the invoice sheet.
          </p>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={lineCount === 0 || isSubmitting}
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs shadow-indigo-200 transition-colors cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            {isSubmitting ? 'Adding...' : `Add ${lineCount > 0 ? `${lineCount} Products` : 'Products'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
