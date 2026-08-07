import React, { useState } from 'react';
import { X, Lock, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { Room } from '../types';

interface RoomPasswordModalProps {
  isOpen: boolean;
  room: Room | null;
  onClose: () => void;
  onConfirm: (password: string) => void;
  errorMsg?: string;
}

export const RoomPasswordModal: React.FC<RoomPasswordModalProps> = ({
  isOpen,
  room,
  onClose,
  onConfirm,
  errorMsg
}) => {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen || !room) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError('請輸入房間密碼');
      return;
    }
    setLocalError('');
    onConfirm(password);
  };

  const currentError = localError || errorMsg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/90 backdrop-blur-2xl shadow-2xl shadow-amber-950/40">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-inner">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>私密房間密碼驗證</span>
              </h2>
              <p className="text-[11px] text-amber-200/80">此房間設有密碼存取保護</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            id="btn-close-password-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Room info preview */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-lg border border-indigo-400/30">
              {room.icon || '💬'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{room.title}</div>
              <div className="text-[10px] text-slate-400 truncate">{room.description}</div>
            </div>
          </div>

          {currentError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-shake">
              {currentError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              請輸入房間存取密碼
            </label>
            <input
              type="password"
              placeholder="輸入房間密碼..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError('');
              }}
              className="w-full rounded-xl border border-amber-500/30 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50 backdrop-blur-md"
              autoFocus
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all active:scale-95"
              id="btn-submit-room-password"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>解鎖進入</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
