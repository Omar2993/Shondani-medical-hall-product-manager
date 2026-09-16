'use client';

import React from 'react';
import { UserRole } from '@/types/product';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
}

export function RoleSwitcher({
  currentRole,
  onRoleChange,
  onOpenAdminLogin,
  onLogoutAdmin,
}: RoleSwitcherProps) {
  const isAdmin = currentRole === 'admin';

  return (
    <div className="flex items-center gap-1.5 bg-slate-900 text-white p-1 rounded-xl shadow-xs border border-slate-700">
      {isAdmin ? (
        /* Logged in as Admin */
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-black shadow-xs select-none">
            <span>👑</span>
            <span>Admin (Omar)</span>
          </div>

          <button
            type="button"
            onClick={onLogoutAdmin}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Log out from Admin account"
          >
            <span>Exit Admin</span>
          </button>
        </div>
      ) : (
        /* Normal User */
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onRoleChange('user')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-xs select-none"
          >
            <span>👤</span>
            <span>Normal User</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-amber-500/30"
            title="Authenticate as Admin"
          >
            <span>👑</span>
            <span>Admin Login</span>
          </button>
        </div>
      )}
    </div>
  );
}
