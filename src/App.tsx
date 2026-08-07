import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CreateRoomModal } from './components/CreateRoomModal';
import { UserProfileModal } from './components/UserProfileModal';
import { NotificationBanner } from './components/NotificationBanner';
import {
  Room,
  Message,
  UserProfile,
  ConnectionStatus,
  CategoryFilter,
  ReplyRef
} from './types';
import { playMessageSound, playJoinSound } from './utils/audio';
import {
  registerServiceWorker,
  initPWAInstallListener,
  promptPWAInstall,
  requestNotificationPermission,
  triggerDesktopNotification
} from './utils/pwa';

const LOCAL_STORAGE_PROFILE_KEY = 'realtime_chat_user_profile_v1';

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'general',
    title: '💬 綜合討論大廳',
    description: '暢所欲言，聊聊生活、興趣與最新時事',
    category: '綜合',
    icon: '💬',
    createdBy: '系統管理員',
    createdAt: Date.now() - 86400000,
    lastMessage: '歡迎大家來到綜合討論大廳！',
    lastMessageTime: Date.now() - 3600000,
    activeUserCount: 1
  },
  {
    id: 'tech',
    title: '💻 前端與技術交流',
    description: '討論 Web 程式開發、React, TypeScript, PWA 與 AI 應用',
    category: '技術',
    icon: '💻',
    createdBy: '系統管理員',
    createdAt: Date.now() - 72000000,
    lastMessage: '大家今天使用什麼 Web 技術開發 App 呢？',
    lastMessageTime: Date.now() - 1800000,
    activeUserCount: 1
  },
  {
    id: 'gaming',
    title: '🎮 遊戲電競熱情區',
    description: '組隊揪團、交流遊戲心得與攻略分享',
    category: '娛樂',
    icon: '🎮',
    createdBy: '系統管理員',
    createdAt: Date.now() - 50000000,
    lastMessage: '今晚有人要一起組隊開黑嗎？',
    lastMessageTime: Date.now() - 900000,
    activeUserCount: 1
  },
  {
    id: 'music',
    title: '🎧 音樂與 Chill 氛圍',
    description: '分享你喜歡的歌單、Podcast 與創作者',
    category: '休閒',
    icon: '🎧',
    createdBy: '系統管理員',
    createdAt: Date.now() - 30000000,
    lastMessage: '推薦大家最近這首很 Chill 的 Lo-Fi 歌曲',
    lastMessageTime: Date.now() - 600000,
    activeUserCount: 1
  }
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  general: [
    {
      id: 'msg_gen_1',
      roomId: 'general',
      userId: 'system',
      username: '🤖 系統助理',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      text: '歡迎來到即時房間聊天室！此 App 支援 WebSocket 即時同步、建立專屬房間、PWA 離線安裝與瀏覽器通知。',
      type: 'text',
      timestamp: Date.now() - 3600000,
      reactions: { '🎉': ['user_demo_1'] }
    }
  ],
  tech: [
    {
      id: 'msg_tech_1',
      roomId: 'tech',
      userId: 'dev_alex',
      username: 'Alex (前端工程師)',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
      text: 'PWA (Progressive Web App) 結合 Service Worker 能讓網頁達到原生 App 般的體驗，大家覺得如何？',
      type: 'text',
      timestamp: Date.now() - 1800000,
      reactions: { '👍': ['user_demo_2'], '🚀': ['user_demo_3'] }
    }
  ]
};

export default function App() {
  // User Profile state
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse user profile from localStorage:', e);
    }
    const seed = Math.random().toString(36).substring(2, 7);
    return {
      userId: 'user_' + seed,
      username: '聊天小夥伴_' + seed.substring(0, 3),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
      soundEnabled: true,
      notificationsEnabled: false
    };
  });

  // UI state
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>('general');
  const [allRoomMessages, setAllRoomMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES['general'] || []);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('全部');

  // Modals & Panels
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [dismissNotificationBanner, setDismissNotificationBanner] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  const userProfileRef = useRef(userProfile);
  const currentRoomIdRef = useRef(currentRoomId);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
    if (currentRoomId) {
      setMessages(allRoomMessages[currentRoomId] || []);
    }
  }, [currentRoomId, allRoomMessages]);

  const activeRoom = rooms.find((r) => r.id === currentRoomId) || rooms[0] || null;

  // Save profile changes
  const handleSaveProfile = (updated: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save profile:', e);
      }
      return next;
    });

    // Notify server of updated username / avatar
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'set_user_info',
          username: updated.username,
          avatar: updated.avatar
        })
      );
    }
  };

  // Connect to WebSocket Server (runs once, persists across state updates)
  useEffect(() => {
    registerServiceWorker();
    initPWAInstallListener((installable) => {
      setIsInstallable(installable);
    });

    let isMounted = true;

    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setStatus('connected');

          const prof = userProfileRef.current;
          const currRoom = currentRoomIdRef.current;

          ws.send(
            JSON.stringify({
              type: 'set_user_info',
              username: prof.username,
              avatar: prof.avatar
            })
          );

          if (currRoom) {
            ws.send(
              JSON.stringify({
                type: 'join_room',
                roomId: currRoom,
                username: prof.username,
                avatar: prof.avatar
              })
            );
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            const prof = userProfileRef.current;
            const currRoomId = currentRoomIdRef.current;

            switch (data.type) {
              case 'connected_init': {
                if (data.userId) {
                  setUserProfile((p) => ({ ...p, userId: data.userId }));
                }
                if (data.rooms && Array.isArray(data.rooms)) {
                  setRooms(data.rooms);
                }
                if (typeof data.onlineUsersCount === 'number') setOnlineCount(data.onlineUsersCount);
                break;
              }

              case 'room_list_updated': {
                if (data.rooms && Array.isArray(data.rooms)) {
                  setRooms(data.rooms);
                }
                if (typeof data.onlineUsersCount === 'number') setOnlineCount(data.onlineUsersCount);
                break;
              }

              case 'joined_room_success': {
                if (data.room) {
                  setRooms((prev) =>
                    prev.map((r) => (r.id === data.room.id ? { ...r, ...data.room } : r))
                  );
                }
                if (data.messages && data.room) {
                  const roomId = data.room.id;
                  setAllRoomMessages((prev) => ({
                    ...prev,
                    [roomId]: data.messages
                  }));
                }
                setTypingUsers([]);
                break;
              }

              case 'new_message': {
                const newMsg: Message = data.message;
                if (newMsg && newMsg.roomId) {
                  setAllRoomMessages((prev) => {
                    const roomMsgs = prev[newMsg.roomId] || [];
                    if (roomMsgs.some((m) => m.id === newMsg.id)) return prev;
                    return { ...prev, [newMsg.roomId]: [...roomMsgs, newMsg] };
                  });

                  if (newMsg.roomId === currRoomId) {
                    if (newMsg.userId !== prof.userId) {
                      if (prof.soundEnabled) playMessageSound();
                      if (prof.notificationsEnabled && document.hidden) {
                        triggerDesktopNotification(
                          `新訊息自 ${newMsg.username}`,
                          newMsg.text || '傳送了一則圖片/檔案'
                        );
                      }
                    }
                  }
                }
                break;
              }

              case 'user_joined_room': {
                if (data.roomId) {
                  if (typeof data.activeUserCount === 'number') {
                    setRooms((prev) =>
                      prev.map((r) => (r.id === data.roomId ? { ...r, activeUserCount: data.activeUserCount } : r))
                    );
                  }
                  if (data.roomId === currRoomId) {
                    const sysMsg: Message = {
                      id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                      roomId: data.roomId,
                      userId: 'system',
                      username: '系統',
                      avatar: '',
                      text: `👋 ${data.username} 進入了聊天房間`,
                      type: 'text',
                      timestamp: data.timestamp || Date.now(),
                      reactions: {}
                    };
                    setAllRoomMessages((prev) => ({
                      ...prev,
                      [data.roomId]: [...(prev[data.roomId] || []), sysMsg]
                    }));
                    if (prof.soundEnabled) playJoinSound();
                  }
                }
                break;
              }

              case 'user_left_room': {
                if (data.roomId) {
                  if (typeof data.activeUserCount === 'number') {
                    setRooms((prev) =>
                      prev.map((r) => (r.id === data.roomId ? { ...r, activeUserCount: data.activeUserCount } : r))
                    );
                  }
                  if (data.roomId === currRoomId) {
                    const sysMsg: Message = {
                      id: 'sys_left_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                      roomId: data.roomId,
                      userId: 'system',
                      username: '系統',
                      avatar: '',
                      text: `🚪 ${data.username} 離開了聊天房間`,
                      type: 'text',
                      timestamp: data.timestamp || Date.now(),
                      reactions: {}
                    };
                    setAllRoomMessages((prev) => ({
                      ...prev,
                      [data.roomId]: [...(prev[data.roomId] || []), sysMsg]
                    }));
                  }
                }
                break;
              }

              case 'user_typing': {
                if (data.roomId === currRoomId && data.userId !== prof.userId) {
                  setTypingUsers((prev) => {
                    if (data.isTyping) {
                      if (!prev.includes(data.username)) return [...prev, data.username];
                      return prev;
                    } else {
                      return prev.filter((u) => u !== data.username);
                    }
                  });
                }
                break;
              }

              case 'reaction_updated': {
                if (data.roomId && data.messageId) {
                  setAllRoomMessages((prev) => {
                    const msgs = prev[data.roomId] || [];
                    const updated = msgs.map((m) =>
                      m.id === data.messageId ? { ...m, reactions: data.reactions } : m
                    );
                    return { ...prev, [data.roomId]: updated };
                  });
                }
                break;
              }

              case 'room_created_success': {
                if (data.roomId) {
                  setCurrentRoomId(data.roomId);
                }
                if (data.room) {
                  setRooms((prev) => {
                    if (prev.some((r) => r.id === data.roomId)) {
                      return prev.map((r) => (r.id === data.roomId ? { ...r, ...data.room } : r));
                    }
                    return [data.room, ...prev];
                  });
                }
                if (data.messages && data.roomId) {
                  setAllRoomMessages((prev) => ({
                    ...prev,
                    [data.roomId]: data.messages
                  }));
                }
                break;
              }
            }
          } catch (err) {
            console.error('Error handling WS event:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setStatus('disconnected');
          reconnectTimerRef.current = setTimeout(() => {
            if (isMounted) {
              setStatus('reconnecting');
              connectWebSocket();
            }
          }, 3000);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
        };
      } catch (err) {
        console.warn('Failed to open WebSocket connection:', err);
        setStatus('disconnected');
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle switching rooms
  const handleSelectRoom = (roomId: string) => {
    if (roomId === currentRoomId) return;

    setCurrentRoomId(roomId);
    setTypingUsers([]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join_room',
          roomId,
          username: userProfile.username,
          avatar: userProfile.avatar
        })
      );
    }
  };

  // Handle message sending
  const handleSendMessage = (payload: {
    text: string;
    msgType: 'text' | 'image' | 'code' | 'file';
    mediaUrl?: string;
    fileName?: string;
    codeLang?: string;
    replyTo?: ReplyRef;
  }) => {
    if (!currentRoomId) return;

    const newMsg: Message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      roomId: currentRoomId,
      userId: userProfile.userId,
      username: userProfile.username,
      avatar: userProfile.avatar,
      text: payload.text || '',
      type: payload.msgType || 'text',
      mediaUrl: payload.mediaUrl,
      fileName: payload.fileName,
      codeLang: payload.codeLang,
      replyTo: payload.replyTo,
      timestamp: Date.now(),
      reactions: {}
    };

    // Broadcast via WS if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'send_message',
          roomId: currentRoomId,
          text: payload.text,
          msgType: payload.msgType,
          mediaUrl: payload.mediaUrl,
          fileName: payload.fileName,
          codeLang: payload.codeLang,
          replyTo: payload.replyTo
        })
      );
    } else {
      // Offline fallback
      setAllRoomMessages((prev) => ({
        ...prev,
        [currentRoomId]: [...(prev[currentRoomId] || []), newMsg]
      }));

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === currentRoomId) {
            return {
              ...r,
              lastMessage:
                newMsg.type === 'image'
                  ? '[📷 圖片]'
                  : newMsg.type === 'code'
                  ? '[💻 程式碼]'
                  : newMsg.type === 'file'
                  ? `[📎 檔案] ${newMsg.fileName || ''}`
                  : newMsg.text,
              lastMessageTime: newMsg.timestamp
            };
          }
          return r;
        })
      );
    }
  };

  // Handle typing status broadcast
  const handleSendTyping = (isTyping: boolean) => {
    if (currentRoomId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          roomId: currentRoomId,
          isTyping
        })
      );
    }
  };

  // Handle adding/toggling emoji reaction
  const handleAddReaction = (messageId: string, emoji: string) => {
    if (!currentRoomId) return;

    setAllRoomMessages((prev) => {
      const roomMsgs = prev[currentRoomId] || [];
      const updated = roomMsgs.map((m) => {
        if (m.id === messageId) {
          const reactions = { ...(m.reactions || {}) };
          const userIds = reactions[emoji] ? [...reactions[emoji]] : [];
          const idx = userIds.indexOf(userProfile.userId);
          if (idx > -1) {
            userIds.splice(idx, 1);
          } else {
            userIds.push(userProfile.userId);
          }
          if (userIds.length > 0) {
            reactions[emoji] = userIds;
          } else {
            delete reactions[emoji];
          }
          return { ...m, reactions };
        }
        return m;
      });
      return { ...prev, [currentRoomId]: updated };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'add_reaction',
          roomId: currentRoomId,
          messageId,
          emoji
        })
      );
    }
  };

  // Handle creating room
  const handleCreateRoom = (roomData: {
    title: string;
    description: string;
    category: string;
    icon: string;
    isPrivate?: boolean;
    password?: string;
  }) => {
    const newRoomId = 'room_' + Date.now();
    const newRoom: Room = {
      id: newRoomId,
      title: roomData.title,
      description: roomData.description || '歡迎加入此聊天房間！',
      category: roomData.category || '綜合',
      icon: roomData.icon || '💬',
      createdBy: userProfile.username,
      createdAt: Date.now(),
      isPrivate: roomData.isPrivate,
      password: roomData.password,
      lastMessage: '新創立的房間，快來聊天吧！',
      lastMessageTime: Date.now(),
      activeUserCount: 1
    };

    const welcomeMsg: Message = {
      id: 'msg_welcome_' + Date.now(),
      roomId: newRoomId,
      userId: 'system',
      username: '🤖 系統助理',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      text: `🎉 歡迎來到「${newRoom.title}」！發送第一條訊息開始聊天吧！`,
      type: 'text',
      timestamp: Date.now(),
      reactions: {}
    };

    // 1. Instantly update local state
    setRooms((prev) => [newRoom, ...prev]);
    setAllRoomMessages((prev) => ({
      ...prev,
      [newRoomId]: [welcomeMsg]
    }));

    // 2. Switch to new room
    setCurrentRoomId(newRoomId);
    setIsCreateModalOpen(false);
    setIsSidebarOpen(false);

    // 3. Send to WS server if available
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'create_room',
          id: newRoomId,
          ...roomData
        })
      );
    }
  };

  // Handle PWA installation
  const handleInstallPWA = async () => {
    const installed = await promptPWAInstall();
    if (installed) {
      setIsInstallable(false);
    }
  };

  // Handle Request Notification Permissions
  const handleRequestNotification = async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      handleSaveProfile({ notificationsEnabled: true });
      triggerDesktopNotification('即時聊天通知已開啟！', '當有新訊息時將會第一時間通知您。');
    } else {
      handleSaveProfile({ notificationsEnabled: false });
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0f172a] font-sans text-slate-100 antialiased selection:bg-indigo-600 selection:text-white">
      {/* Decorative Mesh Gradients for Frosted Glass backdrop */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full z-0" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full z-0" />
      <div className="pointer-events-none absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-500/10 blur-[100px] rounded-full z-0" />

      {/* Header */}
      <Header
        status={status}
        onlineCount={onlineCount}
        userProfile={userProfile}
        isInstallable={isInstallable}
        onInstallPWA={handleInstallPWA}
        onRequestNotification={handleRequestNotification}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleSound={() => handleSaveProfile({ soundEnabled: !userProfile.soundEnabled })}
      />

      {/* Notification / PWA Banner */}
      <NotificationBanner
        showNotificationPrompt={!userProfile.notificationsEnabled && !dismissNotificationBanner}
        isInstallable={isInstallable}
        onRequestNotification={handleRequestNotification}
        onInstallPWA={handleInstallPWA}
        onDismiss={() => setDismissNotificationBanner(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          rooms={rooms}
          currentRoomId={currentRoomId}
          activeCategory={activeCategory}
          isOpen={isSidebarOpen}
          onSelectRoom={handleSelectRoom}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onSelectCategory={(cat) => setActiveCategory(cat)}
          onCloseSidebar={() => setIsSidebarOpen(false)}
        />

        {/* Chat Area */}
        <ChatArea
          room={activeRoom}
          messages={messages}
          userProfile={userProfile}
          typingUsers={typingUsers}
          onSendMessage={handleSendMessage}
          onSendTyping={handleSendTyping}
          onAddReaction={handleAddReaction}
          onOpenMobileSidebar={() => setIsSidebarOpen(true)}
        />
      </div>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateRoom={handleCreateRoom}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        userProfile={userProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}

