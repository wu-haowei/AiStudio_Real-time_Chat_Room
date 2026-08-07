import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Users,
  Lock,
  Hash,
  X,
  Sparkles
} from 'lucide-react';
import { Room, CategoryFilter } from '../types';

interface SidebarProps {
  rooms: Room[];
  currentRoomId: string | null;
  activeCategory: CategoryFilter;
  isOpen: boolean;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateModal: () => void;
  onSelectCategory: (cat: CategoryFilter) => void;
  onCloseSidebar: () => void;
}

const CATEGORIES: CategoryFilter[] = ['全部', '綜合', '技術', '娛樂', '休閒', '自訂'];

export const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  currentRoomId,
  activeCategory,
  isOpen,
  onSelectRoom,
  onOpenCreateModal,
  onSelectCategory,
  onCloseSidebar
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter((room) => {
    const matchesCategory =
      activeCategory === '全部' || room.category === activeCategory;
    const matchesSearch =
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={onCloseSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-800 bg-slate-900/95 transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-400" />
            <h2 className="text-sm font-bold text-slate-100 tracking-wide">
              聊天房間列表 ({rooms.length})
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all shadow-sm shadow-blue-500/20 active:scale-95"
              id="btn-create-room"
              title="建立新聊天房間"
            >
              <Plus className="h-4 w-4" />
              <span>建立房間</span>
            </button>
            <button
              onClick={onCloseSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
              id="btn-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋房間名稱或主題..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Room List Scroll Container */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">尚無符合條件的聊天房間</p>
              <button
                onClick={onOpenCreateModal}
                className="mt-3 text-xs font-medium text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> 立即建立第一個房間
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = currentRoomId === room.id;
              const hasUnread = (room.unreadCount || 0) > 0;

              return (
                <button
                  key={room.id}
                  onClick={() => {
                    onSelectRoom(room.id);
                    onCloseSidebar();
                  }}
                  className={`group relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-900/40 to-slate-800/80 border border-blue-500/40 text-white shadow-sm'
                      : 'border border-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white'
                  }`}
                  id={`room-item-${room.id}`}
                >
                  {/* Room Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-semibold shadow-inner ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                        : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
                    }`}
                  >
                    {room.icon || '💬'}
                  </div>

                  {/* Room Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="truncate text-xs font-bold text-slate-100 flex items-center gap-1">
                        {room.title}
                        {room.isPrivate && (
                          <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                      </h3>
                      {room.lastMessageTime && (
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {formatShortTime(room.lastMessageTime)}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {room.lastMessage || room.description}
                    </p>

                    {/* Footer pills */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-slate-400 border border-slate-700/50">
                        {room.category}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Users className="h-3 w-3 text-emerald-400" />
                          <span>{room.activeUserCount || 0} 人在線</span>
                        </span>

                        {hasUnread && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white animate-bounce">
                            {room.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info box */}
        <div className="border-t border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              即時雙向通信模式
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              WebSocket Active
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

function formatShortTime(timestamp: number) {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}
