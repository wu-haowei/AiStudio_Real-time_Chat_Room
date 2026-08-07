import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Smile,
  Image as ImageIcon,
  Video,
  Code,
  Paperclip,
  Share2,
  Users,
  Copy,
  Check,
  X,
  CornerUpLeft,
  ChevronDown,
  Search,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Lock,
  Trash2
} from 'lucide-react';
import { Room, Message, ReplyRef, UserProfile } from '../types';

interface ChatAreaProps {
  room: Room | null;
  messages: Message[];
  userProfile: UserProfile;
  typingUsers: string[];
  onSendMessage: (payload: {
    text: string;
    msgType: 'text' | 'image' | 'video' | 'code' | 'file';
    mediaUrl?: string;
    fileName?: string;
    codeLang?: string;
    replyTo?: ReplyRef;
  }) => void;
  onSendTyping: (isTyping: boolean) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onOpenMobileSidebar: () => void;
  onDeleteRoom?: (roomId: string, roomTitle: string) => void;
}

const EMOJI_LIST = ['❤️', '👍', '😂', '🔥', '🎉', '🚀', '👏', '😍', '💯', '🙏'];
const QUICK_TEMPLATES = [
  '👋 大家好！很高興認識大家！',
  '👍 收到！沒問題！',
  '🎉 太棒了！真是好消息！',
  '💻 程式碼已經修改好囉！',
  '☕ 休息一下，大家喝杯咖啡吧～'
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  room,
  messages,
  userProfile,
  typingUsers,
  onSendMessage,
  onSendTyping,
  onAddReaction,
  onOpenMobileSidebar,
  onDeleteRoom
}) => {
  const [inputText, setInputText] = useState('');
  const [msgType, setMsgType] = useState<'text' | 'image' | 'video' | 'code' | 'file'>('text');
  const [codeLang, setCodeLang] = useState('javascript');
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyRef | undefined>(undefined);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickTemplates, setShowQuickTemplates] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  if (!room) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-[#0f172a]/80 p-6 text-center backdrop-blur-xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-indigo-400 shadow-2xl mb-4 backdrop-blur-md">
          <MessageSquare className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">請選擇或建立聊天房間</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-4">
          從左側選擇一個聊天房間，或者點擊「建立房間」發起全新的討論話題！
        </p>
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white md:hidden hover:bg-indigo-500 shadow-lg shadow-indigo-600/30"
        >
          查看房間列表
        </button>
      </main>
    );
  }

  const filteredMessages = messages.filter((m) => {
    if (!searchFilter.trim()) return true;
    return (
      m.text.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.username.toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Typing notification handler
    onSendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2000);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !mediaUrl) return;

    onSendMessage({
      text: inputText.trim(),
      msgType,
      mediaUrl: mediaUrl || undefined,
      fileName: fileName || undefined,
      codeLang: msgType === 'code' ? codeLang : undefined,
      replyTo
    });

    setInputText('');
    setMediaUrl('');
    setFileName('');
    setReplyTo(undefined);
    setMsgType('text');
    setShowEmojiPicker(false);
    setShowQuickTemplates(false);
    onSendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShareRoom = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (file.type.startsWith('image/')) {
        setMsgType('image');
        setMediaUrl(result);
        setFileName(file.name);
      } else if (file.type.startsWith('video/')) {
        setMsgType('video');
        setMediaUrl(result);
        setFileName(file.name);
      } else {
        setMsgType('file');
        setMediaUrl(result);
        setFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <main className="flex flex-1 flex-col h-full overflow-hidden bg-transparent relative">
      {/* Room Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 md:hidden hover:bg-white/10"
            title="選單"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-lg shadow-sm">
            {room.icon || '💬'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-white flex items-center gap-1.5">
                {room.title}
                {room.isPrivate && (
                  <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" title="私密保護房間" />
                )}
              </h2>
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-white/10">
                {room.category}
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              {room.description}
            </p>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active members pill */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 border border-white/10 backdrop-blur-md">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span>{room.activeUserCount || 1} 人在線</span>
          </div>

          {/* Search inside room */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋訊息..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-36 rounded-xl border border-white/10 bg-white/5 pl-8 pr-2 py-1 text-xs text-slate-100 placeholder-slate-400 focus:w-48 focus:border-indigo-400 focus:outline-none transition-all backdrop-blur-md"
            />
          </div>

          {/* Share room link */}
          <button
            onClick={handleShareRoom}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white backdrop-blur-md transition-all active:scale-95"
            title="複製邀請連結"
            id="btn-share-room"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">已複製連結</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">邀請好友</span>
              </>
            )}
          </button>

          {/* Delete room button */}
          {room.id !== 'general' && onDeleteRoom && (
            <button
              onClick={() => {
                if (window.confirm(`確定要刪除房間「${room.title}」嗎？刪除後無法恢復。`)) {
                  onDeleteRoom(room.id, room.title);
                }
              }}
              className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 backdrop-blur-md transition-all active:scale-95"
              title="刪除房間"
              id="btn-delete-room"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">刪除房間</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {/* Welcome Room Banner */}
        <div className="my-3 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-2xl border border-indigo-400/30 mb-2">
            {room.icon || '💬'}
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            歡迎來到「{room.title}」
          </h3>
          <p className="text-xs text-slate-300 max-w-md">
            {room.description}。此處的所有訊息將透過 WebSocket 即時同步給房間內的所有人。
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span>建立者：{room.createdBy}</span>
            <span>•</span>
            <span>建立時間：{new Date(room.createdAt).toLocaleDateString('zh-TW')}</span>
          </div>
        </div>

        {/* Message Feed */}
        {filteredMessages.map((msg) => {
          const isSelf = msg.userId === userProfile.userId;
          const isSystem = msg.userId === 'system';

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="my-2 flex justify-center"
                id={`msg-${msg.id}`}
              >
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-slate-300 shadow-sm backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`group flex items-start gap-3 ${
                isSelf ? 'flex-row-reverse' : 'flex-row'
              }`}
              id={`msg-${msg.id}`}
            >
              {/* Avatar */}
              <img
                src={msg.avatar}
                alt={msg.username}
                className="h-9 w-9 shrink-0 rounded-xl bg-white/10 border border-white/20 object-cover mt-0.5 shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://api.dicebear.com/7.x/avataaars/svg?seed=user';
                }}
              />

              {/* Message Bubble Container */}
              <div
                className={`flex max-w-[85%] sm:max-w-[75%] flex-col ${
                  isSelf ? 'items-end' : 'items-start'
                }`}
              >
                {/* User info & timestamp */}
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-semibold text-slate-200">
                    {msg.username}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Reply Ref indicator if replying */}
                {msg.replyTo && (
                  <div
                    className={`mb-1 flex items-center gap-1.5 rounded-xl border bg-black/20 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md ${
                      isSelf
                        ? 'border-indigo-400/30 border-r-4 border-r-indigo-400'
                        : 'border-white/10 border-l-4 border-l-slate-400'
                    }`}
                  >
                    <CornerUpLeft className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-indigo-300 shrink-0">
                      @{msg.replyTo.username}:
                    </span>
                    <span className="truncate max-w-[180px]">
                      {msg.replyTo.text}
                    </span>
                  </div>
                )}

                {/* Bubble Content */}
                <div
                  className={`relative rounded-2xl p-4 text-xs leading-relaxed shadow-lg backdrop-blur-md transition-all ${
                    isSelf
                      ? 'bg-indigo-500/20 border border-indigo-400/30 text-white rounded-tr-none'
                      : 'bg-white/5 border border-white/10 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* Text Message */}
                  {msg.text && (
                    <div className="whitespace-pre-wrap break-words">
                      {msg.text}
                    </div>
                  )}

                  {/* Image Message */}
                  {msg.type === 'image' && msg.mediaUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                      <img
                        src={msg.mediaUrl}
                        alt="attachment"
                        className="max-h-64 w-full object-cover cursor-pointer hover:opacity-95 transition-all"
                        onClick={() => setShowImageModal(msg.mediaUrl!)}
                      />
                    </div>
                  )}

                  {/* Video Message */}
                  {msg.type === 'video' && msg.mediaUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-lg min-w-[240px]">
                      <video
                        src={msg.mediaUrl}
                        controls
                        preload="metadata"
                        className="max-h-80 w-full rounded-xl object-contain bg-black/80"
                      />
                      {msg.fileName && (
                        <div className="px-2.5 py-1.5 text-[11px] text-slate-300 font-medium truncate border-t border-white/10 flex items-center gap-1.5 bg-black/30">
                          <Video className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{msg.fileName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Code Snippet Message */}
                  {msg.type === 'code' && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-emerald-300">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-slate-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                          {msg.codeLang || 'CODE'}
                        </span>
                        <button
                          onClick={() => handleCopyCode(msg.text, msg.id)}
                          className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-white/20"
                        >
                          {copiedCodeId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">已複製</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>複製程式碼</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre font-mono">
                        {msg.text}
                      </pre>
                    </div>
                  )}

                  {/* File Attachment Message */}
                  {msg.type === 'file' && msg.mediaUrl && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5 text-slate-100">
                      <Paperclip className="h-5 w-5 text-indigo-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">
                          {msg.fileName || '檔案附件'}
                        </div>
                      </div>
                      <a
                        href={msg.mediaUrl}
                        download={msg.fileName || 'file'}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 shadow"
                      >
                        <ExternalLink className="h-3 w-3" /> 下載
                      </a>
                    </div>
                  )}

                  {/* Emoji Reactions display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(msg.reactions).map(([emoji, rawUserIds]) => {
                        const userIds = (rawUserIds || []) as string[];
                        const hasReacted = userIds.includes(userProfile.userId);
                        return (
                          <button
                            key={emoji}
                            onClick={() => onAddReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-md transition-all ${
                              hasReacted
                                ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                                : 'bg-white/10 text-slate-300 border border-white/10 hover:bg-white/20'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px] font-semibold">{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Message Hover Actions (Reply, Quick Reaction) */}
                <div
                  className={`mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isSelf ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <button
                    onClick={() =>
                      setReplyTo({
                        id: msg.id,
                        username: msg.username,
                        text: msg.text.substring(0, 50)
                      })
                    }
                    className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white"
                    title="回覆此訊息"
                  >
                    <CornerUpLeft className="h-3 w-3" /> 回覆
                  </button>

                  {/* Quick reactions */}
                  {['❤️', '👍', '🔥'].map((em) => (
                    <button
                      key={em}
                      onClick={() => onAddReaction(msg.id, em)}
                      className="rounded p-0.5 text-xs hover:bg-white/10 transition-transform active:scale-125"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-300 italic px-2 py-1">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </span>
            <span>{typingUsers.join(', ')} 正在輸入中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyTo && (
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-indigo-300">
              正在回覆 @{replyTo.username}:
            </span>
            <span className="truncate text-slate-300">{replyTo.text}</span>
          </div>
          <button
            onClick={() => setReplyTo(undefined)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attachment / Code mode indicator banner */}
      {mediaUrl && (
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {msgType === 'video' ? (
              <Video className="h-4 w-4 text-indigo-400" />
            ) : msgType === 'image' ? (
              <ImageIcon className="h-4 w-4 text-emerald-400" />
            ) : (
              <Paperclip className="h-4 w-4 text-indigo-400" />
            )}
            <span>
              已選擇{msgType === 'video' ? '影片' : msgType === 'image' ? '圖片' : '檔案'}：
              <strong className="text-white ml-1">{fileName || '媒體附件'}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              setMediaUrl('');
              setFileName('');
              setMsgType('text');
            }}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input Form Bar */}
      <div className="border-t border-white/10 bg-white/5 p-3 backdrop-blur-xl">
        {/* Quick Popovers */}
        <div className="relative">
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-30 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-3 shadow-2xl animate-fade-in">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + em);
                    setShowEmojiPicker(false);
                  }}
                  className="text-xl p-1.5 hover:bg-white/10 rounded-xl transition-transform active:scale-125"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {showQuickTemplates && (
            <div className="absolute bottom-full mb-2 left-0 z-30 flex flex-col gap-1 w-72 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-2 shadow-2xl animate-fade-in">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1">
                快捷回覆模板
              </div>
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(tmpl);
                    setShowQuickTemplates(false);
                  }}
                  className="rounded-xl p-2 text-left text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-all"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="flex flex-col gap-2">
          {/* Top Tools Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Emoji popover button */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowQuickTemplates(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md transition-all ${
                  showEmojiPicker
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="插入 Emoji 表情"
              >
                <Smile className="h-4 w-4" />
              </button>

              {/* Quick templates */}
              <button
                type="button"
                onClick={() => {
                  setShowQuickTemplates(!showQuickTemplates);
                  setShowEmojiPicker(false);
                }}
                className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-white/10 backdrop-blur-md transition-all"
                title="選擇快捷對話範本"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">常用詞語</span>
              </button>

              {/* Code snippet toggle */}
              <button
                type="button"
                onClick={() => {
                  if (msgType === 'code') {
                    setMsgType('text');
                  } else {
                    setMsgType('code');
                  }
                }}
                className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs backdrop-blur-md transition-all ${
                  msgType === 'code'
                    ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="切換程式碼發送模式"
              >
                <Code className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">程式碼</span>
              </button>

              {/* Image Upload */}
              <label
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 backdrop-blur-md cursor-pointer transition-all"
                title="傳送圖片"
              >
                <ImageIcon className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*"
                />
              </label>

              {/* Video Upload */}
              <label
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 backdrop-blur-md cursor-pointer transition-all"
                title="傳送影片 (MP4, WebM, MOV)"
              >
                <Video className="h-4 w-4 text-indigo-400" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="video/*, .mp4, .webm, .mov, .ogg"
                />
              </label>

              {/* General File Upload */}
              <label
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 backdrop-blur-md cursor-pointer transition-all"
                title="傳送文件檔案"
              >
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".txt, .pdf, .doc, .docx, .json, .zip, .rar"
                />
              </label>
            </div>

            {msgType === 'code' && (
              <select
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none backdrop-blur-md"
              >
                <option value="javascript" className="bg-slate-900">JavaScript / TS</option>
                <option value="html" className="bg-slate-900">HTML / CSS</option>
                <option value="python" className="bg-slate-900">Python</option>
                <option value="json" className="bg-slate-900">JSON</option>
                <option value="sql" className="bg-slate-900">SQL</option>
              </select>
            )}
          </div>

          {/* Main Textarea & Send Button */}
          <div className="flex items-end gap-2">
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                msgType === 'code'
                  ? '請在此貼上或輸入程式碼片段...'
                  : `傳送訊息至「${room.title}」... (Enter 發送，Shift+Enter 換行)`
              }
              rows={msgType === 'code' ? 3 : 2}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 backdrop-blur-md resize-none font-sans"
            />

            <button
              type="submit"
              disabled={!inputText.trim() && !mediaUrl}
              className="flex h-11 w-12 items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
              id="btn-send-message"
              title="發送訊息"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Image Modal Preview */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
          onClick={() => setShowImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <button
              onClick={() => setShowImageModal(null)}
              className="absolute top-3 right-3 rounded-full bg-slate-950/80 p-2 text-white hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={showImageModal}
              alt="Expanded Preview"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
};

function formatTime(timestamp: number) {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}
