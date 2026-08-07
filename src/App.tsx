import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>('general');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Connect to WebSocket Server
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');

      // Send initial user info
      ws.send(
        JSON.stringify({
          type: 'set_user_info',
          username: userProfile.username,
          avatar: userProfile.avatar
        })
      );

      // Join target room if selected
      if (currentRoomId) {
        ws.send(
          JSON.stringify({
            type: 'join_room',
            roomId: currentRoomId,
            username: userProfile.username,
            avatar: userProfile.avatar
          })
        );
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected_init': {
            if (data.userId) {
              setUserProfile((p) => ({ ...p, userId: data.userId }));
            }
            if (data.rooms) setRooms(data.rooms);
            if (data.onlineUsersCount) setOnlineCount(data.onlineUsersCount);
            break;
          }

          case 'room_list_updated': {
            if (data.rooms) setRooms(data.rooms);
            if (data.onlineUsersCount) setOnlineCount(data.onlineUsersCount);
            break;
          }

          case 'joined_room_success': {
            if (data.room) setActiveRoom(data.room);
            if (data.messages) setMessages(data.messages);
            setTypingUsers([]);
            break;
          }

          case 'new_message': {
            const newMsg: Message = data.message;
            if (newMsg && newMsg.roomId === currentRoomId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              // Play sound & notify if message from another user
              if (newMsg.userId !== userProfile.userId) {
                if (userProfile.soundEnabled) {
                  playMessageSound();
                }

                if (userProfile.notificationsEnabled && document.hidden) {
                  triggerDesktopNotification(
                    `新訊息自 ${newMsg.username}`,
                    newMsg.text || '傳送了一則圖片/附件'
                  );
                }
              }
            }
            break;
          }

          case 'user_joined_room': {
            if (data.roomId === currentRoomId) {
              setMessages((prev) => [
                ...prev,
                {
                  id: 'sys_' + Date.now(),
                  roomId: data.roomId,
                  userId: 'system',
                  username: '系統',
                  avatar: '',
                  text: `👋 ${data.username} 進入了聊天房間`,
                  type: 'text',
                  timestamp: data.timestamp,
                  reactions: {}
                }
              ]);
              if (userProfile.soundEnabled) playJoinSound();
            }
            break;
          }

          case 'user_left_room': {
            if (data.roomId === currentRoomId) {
              setMessages((prev) => [
                ...prev,
                {
                  id: 'sys_left_' + Date.now(),
                  roomId: data.roomId,
                  userId: 'system',
                  username: '系統',
                  avatar: '',
                  text: `🚪 ${data.username} 離開了聊天房間`,
                  type: 'text',
                  timestamp: data.timestamp,
                  reactions: {}
                }
              ]);
            }
            break;
          }

          case 'user_typing': {
            if (data.roomId === currentRoomId && data.userId !== userProfile.userId) {
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
            if (data.roomId === currentRoomId) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === data.messageId) {
                    return { ...m, reactions: data.reactions };
                  }
                  return m;
                })
              );
            }
            break;
          }

          case 'room_created_success': {
            if (data.roomId) {
              handleSelectRoom(data.roomId);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WS event:', err);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      // Retry connection after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        setStatus('reconnecting');
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
      ws.close();
    };
  }, [currentRoomId, userProfile.username, userProfile.avatar, userProfile.soundEnabled, userProfile.notificationsEnabled, userProfile.userId]);

  // Initial setup: Register SW, PWA install prompt & WS connection
  useEffect(() => {
    registerServiceWorker();
    initPWAInstallListener((installable) => {
      setIsInstallable(installable);
    });

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Handle switching rooms
  const handleSelectRoom = (roomId: string) => {
    if (roomId === currentRoomId) return;

    setCurrentRoomId(roomId);
    setMessages([]);
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
    if (!currentRoomId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

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
    if (currentRoomId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

  // Handle creating room via WS
  const handleCreateRoom = (roomData: {
    title: string;
    description: string;
    category: string;
    icon: string;
    isPrivate?: boolean;
    password?: string;
  }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'create_room',
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
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
