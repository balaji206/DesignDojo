import React, { useState, useRef, useEffect } from 'react';
import { User, LogIn, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';

export const UserNav: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user, openAuthModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => openAuthModal('LOGIN')}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  const initial = (user.name || user.email || 'U')[0].toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 transition"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-[11px] font-bold shadow">
          {initial}
        </div>
        {!compact && (
          <span className="text-xs font-medium max-w-[120px] truncate text-slate-200">
            {user.name || user.email.split('@')[0]}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in duration-150">
          <div className="px-3 py-2 border-b border-slate-800 mb-1">
            <p className="text-xs font-semibold text-white truncate">{user.name || 'Learner'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
          </div>

          <button
            onClick={() => {
              setDropdownOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
