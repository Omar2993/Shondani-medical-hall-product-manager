'use client';

import React, { useState } from 'react';
import { XIcon, CheckIcon, AlertCircleIcon, EyeIcon, EyeOffIcon } from './icons';
import { verifyAdminCredentials } from '@/actions/authorizedProductActions';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export function AdminLoginModal({
  isOpen,
  onClose,
  onSuccess,
}: AdminLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    try {
      const res = await verifyAdminCredentials(cleanUser, cleanPass);
      if (res.success && res.data) {
        onSuccess(res.data.token);
        setUsername('');
        setPassword('');
        setError('');
        onClose();
      } else {
        setError(res.error || 'Invalid admin username or password. Access denied.');
      }
    } catch {
      setError('An error occurred while attempting to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = () => {
    setUsername('Omar');
    setPassword('Omar88067');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrator Login</h3>
              <p className="text-xs text-slate-500">Shondani Medical Hall Staff Only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircleIcon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Username / Name
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Omar"
              autoFocus
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOffIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-700">Admin Account:</span>{' '}
              Username: <code className="font-bold text-amber-800">Omar</code> • Password: <code className="font-bold text-amber-800">Omar88067</code>
            </div>
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Click to automatically fill credentials"
            >
              Auto-fill
            </button>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as Admin</span>
                  <CheckIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
