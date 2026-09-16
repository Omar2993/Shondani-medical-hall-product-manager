'use client';

import React, { useState, useRef } from 'react';
import { SearchIcon, XIcon } from './icons';
import { FilterType } from '@/types/product';

interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  totalCount: number;
  filteredCount: number;
  inStockCount: number;
  outOfStockCount: number;
  needOrderCount: number;
}

export function SearchAndFilterBar({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  totalCount,
  filteredCount: _filteredCount,
  inStockCount,
  outOfStockCount,
  needOrderCount,
}: SearchAndFilterBarProps) {
  // Local state for 0ms lag-free mobile typing
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery);
    setLocalQuery(searchQuery);
  }

  const handleInputChange = (val: string) => {
    setLocalQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onSearchChange(val);
    }, 100);
  };

  const handleClear = () => {
    setLocalQuery('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onSearchChange('');
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-lg border border-slate-200 shadow-xs">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[180px]">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
          <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <input
          type="text"
          value={localQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search products in Shondani..."
          className="w-full pl-7.5 pr-7 py-1 sm:py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder-slate-400 transition-all"
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Clear"
          >
            <XIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center overflow-x-auto pb-0.5 sm:pb-0 gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200 shrink-0 text-xs">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
            filter === 'all'
              ? 'bg-white text-indigo-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>All</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filter === 'all' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200 text-slate-600'}`}>
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('in_stock')}
          className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
            filter === 'in_stock'
              ? 'bg-white text-emerald-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>In Stock</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filter === 'in_stock' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-200 text-slate-600'}`}>
            {inStockCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('out_of_stock')}
          className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
            filter === 'out_of_stock'
              ? 'bg-white text-rose-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Out of Stock</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filter === 'out_of_stock' ? 'bg-rose-100 text-rose-800 font-bold' : 'bg-slate-200 text-slate-600'}`}>
            {outOfStockCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange('need_order')}
          className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
            filter === 'need_order'
              ? 'bg-white text-indigo-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>In Order</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filter === 'need_order' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200 text-slate-600'}`}>
            {needOrderCount}
          </span>
        </button>
      </div>
    </div>
  );
}
