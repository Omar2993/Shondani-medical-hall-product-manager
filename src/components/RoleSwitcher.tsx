'use client';

import React from 'react';
import { UserRole } from '@/types/product';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/90 text-white p-1.5 rounded-xl shadow-xs border border-slate-700">
      <span className="text-[11px] font-semibold text-slate-400 pl-2 hidden sm:inline select-none">
        Role:
      </span>

      <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
        {/* Admin Button */}
        <button
          type="button"
          onClick={() => onRoleChange('admin')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            currentRole === 'admin'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
          }`}
          title="Admin: Full inventory & product management, stock editing, row inserting/deleting"
        >
          <span>👑</span>
          <span>Admin</span>
        </button>

        {/* Normal User Button */}
        <button
          type="button"
          onClick={() => onRoleChange('user')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            currentRole === 'user'
              ? 'bg-indigo-500 text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
          }`}
          title="Normal User: View catalog, enter order quantities, Price × Order Qty calculation, submit order"
        >
          <span>👤</span>
          <span>Normal User</span>
        </button>
      </div>
    </div>
  );
}
