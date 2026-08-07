import React, { useState } from 'react';
import { X, User, RefreshCw, Volume2, VolumeX, Bell, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  userProfile: UserProfile;
  onClose: () => void;
  onSaveProfile: (profile: Partial<UserProfile>) => void;
}

const PRESET_SEEDS = ['Alex', 'Mia', 'Lucas', 'Emma', 'Oliver', 'Sophia', 'Ethan', 'Ava', 'Leo', 'Zoe'];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  userProfile,
  onClose,
  onSaveProfile
}) => {
  const [username, setUsername] = useState(userProfile.username);
  const [avatar, setAvatar] = useState(userProfile.avatar);
  const [soundEnabled, setSoundEnabled] = useState(userProfile.soundEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(userProfile.notificationsEnabled);

  if (!isOpen) return null;

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`);
  };

  const handleSelectPresetAvatar = (seed: string) => {
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      username: username.trim() || '熱情聊天者',
      avatar,
      soundEnabled,
      notificationsEnabled
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-indigo-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">設定個人暱稱與頭像</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            id="btn-close-profile-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <img
                src={avatar}
                alt="User Avatar"
                className="h-20 w-20 rounded-2xl bg-white/5 p-1 border-2 border-indigo-400/50 shadow-xl"
              />
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-500 transition-all active:scale-95"
                title="隨機生成造型"
                id="btn-random-avatar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {PRESET_SEEDS.map((seed) => {
                const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                const isSelected = avatar === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(seed)}
                    className={`h-9 w-9 overflow-hidden rounded-xl border bg-black/20 p-0.5 transition-all ${
                      isSelected
                        ? 'border-indigo-400 ring-2 ring-indigo-400/40 opacity-100 scale-105'
                        : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={seed} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              顯示暱稱
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md"
              placeholder="請輸入您的聊天暱稱"
              maxLength={25}
              required
            />
          </div>

          {/* Sound & Notification Toggles */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition-all">
              <div className="flex items-center gap-2.5">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-indigo-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-200">新訊息音效提醒</div>
                  <div className="text-[11px] text-slate-400">當有新訊息時播放微弱的提示音</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition-all">
              <div className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-indigo-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">瀏覽器推播通知</div>
                  <div className="text-[11px] text-slate-400">當分頁隱藏時接收新訊息面板通知</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Footer Actions */}
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
              id="btn-save-profile"
            >
              <Check className="h-4 w-4" />
              <span>儲存變更</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
