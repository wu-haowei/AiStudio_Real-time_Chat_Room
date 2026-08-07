import React, { useState } from 'react';
import { X, MessageSquare, Plus, Lock, Globe, Sparkles } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (data: {
    title: string;
    description: string;
    category: string;
    icon: string;
    isPrivate?: boolean;
    password?: string;
  }) => void;
}

const ICONS = ['💬', '🎮', '💻', '☕', '🎧', '🚀', '🎨', '📚', '⚽', '💡', '🔥', '🏆', '🌐', '🤖'];
const CATEGORIES = ['綜合', '技術', '娛樂', '休閒', '自訂'];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('綜合');
  const [icon, setIcon] = useState('💬');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('請輸入房間名稱');
      return;
    }

    onCreateRoom({
      title: title.trim(),
      description: description.trim() || '歡迎加入此聊天房間！',
      category,
      icon,
      isPrivate,
      password: isPrivate ? password : undefined
    });

    // Reset form
    setTitle('');
    setDescription('');
    setCategory('綜合');
    setIcon('💬');
    setIsPrivate(false);
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-indigo-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">建立全新聊天房間</h2>
              <p className="text-xs text-slate-400">建立專屬頻道邀請朋友一起即時聊天</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            id="btn-close-create-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              選擇房間圖示
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-all ${
                    icon === ic
                      ? 'bg-indigo-600 text-white scale-105 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-lg'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              房間名稱 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="例如：🎮 寶可夢對戰交流室"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md"
              maxLength={30}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              分類主題
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              房間介紹與簡介
            </label>
            <textarea
              placeholder="簡短描述這個房間的討論主題..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md resize-none"
              maxLength={120}
            />
          </div>

          {/* Private Room Option */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">私密房間密碼保護</div>
                  <div className="text-[11px] text-slate-400">開啟後需輸入密碼才能加入此聊天室</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {isPrivate && (
              <div className="mt-3 pt-2 border-t border-white/10">
                <input
                  type="password"
                  placeholder="請設定房間密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95"
              id="btn-submit-create-room"
            >
              <Sparkles className="h-4 w-4" />
              <span>儲存並建立房間</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
