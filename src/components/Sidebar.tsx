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
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              聊天房間列表 ({rooms.length})
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-md active:scale-95"
              id="btn-create-room"
              title="建立新聊天房間"
            >
              <Plus className="h-4 w-4" />
              <span>建立房間</span>
            </button>
            <button
              onClick={onCloseSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
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
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
              className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium backdrop-blur-md transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Room List Scroll Container */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-10 w-10 text-slate-500 mb-2" />
              <p className="text-xs text-slate-400">尚無符合條件的聊天房間</p>
              <button
                onClick={onOpenCreateModal}
                className="mt-3 text-xs font-medium text-indigo-300 hover:underline flex items-center gap-1"
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
                  className={`group relative flex w-full items-start gap-3 rounded-xl p-3 text-left backdrop-blur-md transition-all ${
                    isSelected
                      ? 'bg-white/15 border border-white/20 text-white shadow-lg'
                      : 'border border-transparent hover:bg-white/5 text-slate-300 hover:text-white'
                  }`}
                  id={`room-item-${room.id}`}
                >
                  {/* Room Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-semibold shadow-inner transition-all ${
                      isSelected
                        ? 'bg-indigo-500/30 border border-indigo-400/40 text-indigo-200'
                        : 'bg-white/10 text-slate-300 group-hover:bg-white/15'
                    }`}
                  >
                    {room.icon || '💬'}
                  </div>

                  {/* Room Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="truncate text-xs font-bold text-white flex items-center gap-1">
                        {room.title}
                        {room.isPrivate && (
                          <Lock className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                      </h3>
                      {room.lastMessageTime && (
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatShortTime(room.lastMessageTime)}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {room.lastMessage || room.description}
                    </p>

                    {/* Footer pills */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-slate-300 border border-white/10">
                        {room.category}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Users className="h-3 w-3 text-emerald-400" />
                          <span>{room.activeUserCount || 0} 人在線</span>
                        </span>

                        {hasUnread && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white animate-bounce">
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
        <div className="border-t border-white/10 bg-black/20 p-4 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            即時雙向通信模式
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            WebSocket Active
          </span>
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
