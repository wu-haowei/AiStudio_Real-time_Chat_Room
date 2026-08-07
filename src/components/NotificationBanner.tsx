import React from 'react';
import { Bell, Download, X, Sparkles } from 'lucide-react';

interface NotificationBannerProps {
  showNotificationPrompt: boolean;
  isInstallable: boolean;
  onRequestNotification: () => void;
  onInstallPWA: () => void;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  showNotificationPrompt,
  isInstallable,
  onRequestNotification,
  onInstallPWA,
  onDismiss
}) => {
  if (!showNotificationPrompt && !isInstallable) return null;

  return (
    <div className="relative border-b border-blue-500/20 bg-gradient-to-r from-blue-950/90 via-indigo-950/80 to-slate-900 px-4 py-2 text-xs text-slate-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-blue-400 shrink-0 animate-spin-slow" />
          <p className="truncate">
            {showNotificationPrompt ? (
              <span>
                開啟桌面/手機瀏覽器通知，當收到新訊息時及時獲得即時推播提醒！
              </span>
            ) : (
              <span>
                支援 PWA 網頁應用！點擊安裝按鈕即可新增至主畫面，隨時隨地輕鬆開啟聊天。
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showNotificationPrompt && (
            <button
              onClick={onRequestNotification}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-500 transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>開啟通知</span>
            </button>
          )}

          {isInstallable && (
            <button
              onClick={onInstallPWA}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-500 transition-all shadow-sm shadow-indigo-500/20 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>安裝 App</span>
            </button>
          )}

          <button
            onClick={onDismiss}
            className="rounded p-1 text-slate-400 hover:text-white"
            title="關閉提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
