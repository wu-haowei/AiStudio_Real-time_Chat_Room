import React from 'react';
import {
  MessageSquare,
  Download,
  Bell,
  BellOff,
  User,
  Wifi,
  WifiOff,
  Menu,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import { ConnectionStatus, UserProfile } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  onlineCount: number;
  userProfile: UserProfile;
  isInstallable: boolean;
  onInstallPWA: () => void;
  onRequestNotification: () => void;
  onOpenProfile: () => void;
  onToggleSidebar: () => void;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onlineCount,
  userProfile,
  isInstallable,
  onInstallPWA,
  onRequestNotification,
  onOpenProfile,
  onToggleSidebar,
  onToggleSound
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 backdrop-blur-md transition-all">
      {/* Left: Mobile Menu & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white md:hidden"
          title="開啟房間選單"
          id="btn-toggle-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                即時房間聊天室
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3 w-3" /> PWA 支援
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              WebSocket 即時同步 • 房間建立 • 離線快取
            </p>
          </div>
        </div>
      </div>

      {/* Center: Connection Status & Online Badge */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Connection status indicator */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
            status === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : status === 'connecting' || status === 'reconnecting'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          {status === 'connected' ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span>已連線伺服器</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span>
                {status === 'reconnecting' ? '重新連線中...' : '伺服器連線中'}
              </span>
            </>
          )}
        </div>

        {/* Online count */}
        <div className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300 border border-slate-700/60">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>線上人數：{onlineCount} 人</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Sound toggle */}
        <button
          onClick={onToggleSound}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
            userProfile.soundEnabled
              ? 'border-slate-700/60 bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-700'
              : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-400'
          }`}
          title={userProfile.soundEnabled ? '音效已開啟' : '音效已靜音'}
          id="btn-toggle-sound"
        >
          {userProfile.soundEnabled ? (
            <Volume2 className="h-4 w-4 text-blue-400" />
          ) : (
            <VolumeX className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {/* Notification permissions toggle */}
        <button
          onClick={onRequestNotification}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all ${
            userProfile.notificationsEnabled
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              : 'border-slate-700/60 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title={
            userProfile.notificationsEnabled
              ? '瀏覽器即時通知已開啟'
              : '點擊開啟瀏覽器即時訊息通知'
          }
          id="btn-toggle-notification"
        >
          {userProfile.notificationsEnabled ? (
            <>
              <Bell className="h-4 w-4 text-blue-400" />
              <span className="hidden sm:inline">通知開啟</span>
            </>
          ) : (
            <>
              <BellOff className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">開啟通知</span>
            </>
          )}
        </button>

        {/* PWA Install Button */}
        {isInstallable && (
          <button
            onClick={onInstallPWA}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95"
            id="btn-install-pwa"
          >
            <Download className="h-4 w-4 animate-bounce" />
            <span>安裝 PWA App</span>
          </button>
        )}

        {/* User Profile Avatar / Trigger */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 p-1 pr-2.5 hover:bg-slate-700/80 transition-all active:scale-95"
          title="修改個人名稱與頭像"
          id="btn-user-profile"
        >
          <img
            src={userProfile.avatar}
            alt={userProfile.username}
            className="h-8 w-8 rounded-lg bg-slate-900 object-cover border border-slate-700"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://api.dicebear.com/7.x/bottts/svg?seed=user';
            }}
          />
          <span className="text-xs font-medium text-slate-200 max-w-[90px] truncate hidden sm:inline-block">
            {userProfile.username}
          </span>
        </button>
      </div>
    </header>
  );
};
