import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CreateRoomModal } from './components/CreateRoomModal';
import { RoomPasswordModal } from './components/RoomPasswordModal';
import { UserProfileModal } from './components/UserProfileModal';
import { NotificationBanner } from './components/NotificationBanner';
import { P2PManager } from './utils/p2p';
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
const LOCAL_STORAGE_ROOMS_KEY = 'realtime_chat_rooms_v3';
const LOCAL_STORAGE_MSGS_KEY = 'realtime_chat_msgs_v3';
const LOCAL_STORAGE_UNLOCKED_ROOMS_KEY = 'realtime_chat_unlocked_rooms_v1';

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
      text: '歡迎來到即時房間聊天室！此 App 支援 WebSocket / WebRTC 即時同步、建立專屬房間、圖片與影片分享、PWA 離線安裝與瀏覽器通知。',
      type: 'text',
      timestamp: Date.now() - 3600000,
      reactions: { '🎉': ['user_demo_1'] }
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
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_ROOMS;
  });
  const [currentRoomId, setCurrentRoomId] = useState<string | null>('general');
  const [allRoomMessages, setAllRoomMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MSGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return INITIAL_MESSAGES;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('全部');

  // Unlocked Room IDs & Password Modal State
  const [unlockedRoomIds, setUnlockedRoomIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_UNLOCKED_ROOMS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['general'];
  });
  const [pendingRoomForPassword, setPendingRoomForPassword] = useState<Room | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  // Modals & Panels
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [dismissNotificationBanner, setDismissNotificationBanner] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const p2pRef = useRef<P2PManager | null>(null);

  const tabIdRef = useRef<string>('tab_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now());
  const activePeersRef = useRef<Map<string, { tabId: string; userId: string; roomId: string | null; lastSeen: number }>>(new Map());
  const [simulatedBaseOnline, setSimulatedBaseOnline] = useState<number>(7);

  const userProfileRef = useRef(userProfile);
  const currentRoomIdRef = useRef(currentRoomId);
  const roomsRef = useRef(rooms);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

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

  // BroadcastChannel and Storage Listener for instant multi-tab & multi-window sync (especially on static hosts like GitHub Pages)
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('chat_app_sync_v3');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'new_message' && data.roomId && data.message) {
          setAllRoomMessages((prev) => {
            const list = prev[data.roomId] || [];
            if (list.some((m) => m.id === data.message.id)) return prev;
            const updated = [...list, data.message];
            const next = { ...prev, [data.roomId]: updated };
            try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });

          setRooms((prev) => {
            const next = prev.map((r) => {
              if (r.id === data.roomId) {
                return {
                  ...r,
                  lastMessage:
                    data.message.type === 'image'
                      ? '[📷 圖片]'
                      : data.message.type === 'code'
                      ? '[💻 程式碼]'
                      : data.message.type === 'file'
                      ? `[📎 檔案] ${data.message.fileName || ''}`
                      : data.message.text,
                  lastMessageTime: data.message.timestamp
                };
              }
              return r;
            });
            try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });

          if (data.roomId === currentRoomIdRef.current && data.message.userId !== userProfileRef.current.userId) {
            if (userProfileRef.current.soundEnabled) playMessageSound();
          }
        }

        if (data.type === 'create_room' && data.room) {
          setRooms((prev) => {
            if (prev.some((r) => r.id === data.room.id)) return prev;
            const next = [data.room, ...prev];
            try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });
          if (data.welcomeMsg) {
            setAllRoomMessages((prev) => {
              if (prev[data.room.id]) return prev;
              const next = { ...prev, [data.room.id]: [data.welcomeMsg] };
              try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        }

        if ((data.type === 'presence_ping' || data.type === 'presence_pong') && data.tabId && data.tabId !== tabIdRef.current) {
          activePeersRef.current.set(data.tabId, {
            tabId: data.tabId,
            userId: data.userId,
            roomId: data.roomId || null,
            lastSeen: Date.now()
          });

          if (data.type === 'presence_ping' && broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'presence_pong',
                tabId: tabIdRef.current,
                userId: userProfileRef.current.userId,
                roomId: currentRoomIdRef.current,
                timestamp: Date.now()
              });
            } catch {}
          }
        }

        if (data.type === 'add_reaction' && data.roomId && data.messageId && data.reactions) {
          setAllRoomMessages((prev) => {
            const msgs = prev[data.roomId] || [];
            const updated = msgs.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
            const next = { ...prev, [data.roomId]: updated };
            try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_MSGS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setAllRoomMessages(parsed);
        } catch {}
      }
      if (e.key === LOCAL_STORAGE_ROOMS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setRooms(parsed);
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // Detect if running on a static host (like GitHub Pages) without Node.js backend
  const isStaticHost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname.toLowerCase();
    return h.includes('github.io') || h.includes('github.dev') || window.location.protocol === 'file:';
  }, []);

  // WebRTC P2P Manager for cross-device & cross-browser real-time sync on static hosts
  useEffect(() => {
    const p2p = new P2PManager({
      onMessage: (message) => {
        setAllRoomMessages((prev) => {
          const list = prev[message.roomId] || [];
          if (list.some((m) => m.id === message.id)) return prev;
          const updated = [...list, message];
          const next = { ...prev, [message.roomId]: updated };
          try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });

        setRooms((prev) => {
          const next = prev.map((r) => {
            if (r.id === message.roomId) {
              return {
                ...r,
                lastMessage:
                  message.type === 'image'
                    ? '[📷 圖片]'
                    : message.type === 'video'
                    ? '[🎥 影片]'
                    : message.type === 'code'
                    ? '[💻 程式碼]'
                    : message.type === 'file'
                    ? `[📎 檔案] ${message.fileName || ''}`
                    : message.text,
                lastMessageTime: message.timestamp
              };
            }
            return r;
          });
          try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });

        if (message.roomId === currentRoomIdRef.current && message.userId !== userProfileRef.current.userId) {
          if (userProfileRef.current.soundEnabled) playMessageSound();
        }
      },
      onReaction: (roomId, messageId, reactions) => {
        setAllRoomMessages((prev) => {
          const msgs = prev[roomId] || [];
          const updated = msgs.map((m) => (m.id === messageId ? { ...m, reactions } : m));
          const next = { ...prev, [roomId]: updated };
          try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
      },
      onCreateRoom: (room, welcomeMsg) => {
        setRooms((prev) => {
          if (prev.some((r) => r.id === room.id)) return prev;
          const next = [room, ...prev];
          try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
        if (welcomeMsg) {
          setAllRoomMessages((prev) => {
            if (prev[room.id]) return prev;
            const next = { ...prev, [room.id]: [welcomeMsg] };
            try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });
        }
      },
      onPeerCountChange: (count) => {
        if (count > 1) {
          setOnlineCount((prev) => Math.max(prev, count + 6));
        }
      }
    });

    p2pRef.current = p2p;

    return () => {
      p2p.leaveRoom();
    };
  }, []);

  // Sync P2P room subscription
  useEffect(() => {
    if (currentRoomId && p2pRef.current) {
      p2pRef.current.joinRoom(currentRoomId, userProfile.userId);
    }
  }, [currentRoomId, userProfile.userId]);

  // Active presence heartbeat & real-time online count calculation
  useEffect(() => {
    const updatePresence = () => {
      const now = Date.now();

      // 1. Send ping to other active tabs / windows
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'presence_ping',
            tabId: tabIdRef.current,
            userId: userProfileRef.current.userId,
            roomId: currentRoomIdRef.current,
            timestamp: now
          });
        } catch {}
      }

      // 2. Filter out stale tabs (> 4.5 seconds old)
      activePeersRef.current.forEach((peer, id) => {
        if (now - peer.lastSeen > 4500) {
          activePeersRef.current.delete(id);
        }
      });

      // 3. Count active tabs per room
      const roomTabCounts: Record<string, number> = {};
      activePeersRef.current.forEach((peer) => {
        if (peer.roomId) {
          roomTabCounts[peer.roomId] = (roomTabCounts[peer.roomId] || 0) + 1;
        }
      });
      if (currentRoomIdRef.current) {
        roomTabCounts[currentRoomIdRef.current] = (roomTabCounts[currentRoomIdRef.current] || 0) + 1;
      }

      const activePeersCount = activePeersRef.current.size + 1; // self + peers

      // 4. Update overall online user count
      const totalOnline = activePeersCount + simulatedBaseOnline;
      setOnlineCount(totalOnline);

      // 5. Dynamic room active user count distribution
      setRooms((prevRooms) => {
        let hasChange = false;
        const updated = prevRooms.map((room) => {
          let baseRoomCount = 1;
          if (room.id === 'general') {
            baseRoomCount = Math.max(1, Math.floor(simulatedBaseOnline * 0.7));
          } else {
            baseRoomCount = Math.max(1, Math.floor(simulatedBaseOnline * 0.15));
          }

          const activeInRoom = baseRoomCount + (roomTabCounts[room.id] || 0);

          if (room.activeUserCount !== activeInRoom) {
            hasChange = true;
            return { ...room, activeUserCount: activeInRoom };
          }
          return room;
        });

        return hasChange ? updated : prevRooms;
      });
    };

    updatePresence();
    const presenceTimer = setInterval(updatePresence, 2000);

    // Periodic organic fluctuation (+1, 0, -1) every 9 seconds
    const fluctuationTimer = setInterval(() => {
      setSimulatedBaseOnline((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        const next = prev + delta;
        return next < 4 ? 4 : next > 18 ? 18 : next;
      });
    }, 9000);

    return () => {
      clearInterval(presenceTimer);
      clearInterval(fluctuationTimer);
    };
  }, [simulatedBaseOnline]);

  // Connect to WebSocket Server (runs once, persists across state updates)
  useEffect(() => {
    registerServiceWorker();
    initPWAInstallListener((installable) => {
      setIsInstallable(installable);
    });

    let isMounted = true;

    // On static hosts (e.g. GitHub Pages), skip WS server connection to avoid console 404/WS errors
    if (isStaticHost) {
      setStatus('connected');
      return;
    }

    let failureCount = 0;

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
          failureCount = 0;
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
            const roomObj = roomsRef.current.find((r) => r.id === currRoom);
            ws.send(
              JSON.stringify({
                type: 'join_room',
                roomId: currRoom,
                password: roomObj?.password,
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

                // Auto-join target room upon connection initialization
                const targetRoomId = currentRoomIdRef.current || 'general';
                const roomObj = (data.rooms || roomsRef.current).find((r: Room) => r.id === targetRoomId);
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: 'join_room',
                      roomId: targetRoomId,
                      password: roomObj?.password,
                      username: userProfileRef.current.username,
                      avatar: userProfileRef.current.avatar
                    })
                  );
                }
                break;
              }

              case 'room_password_invalid': {
                if (data.roomId) {
                  const targetRoom = roomsRef.current.find((r) => r.id === data.roomId);
                  if (targetRoom) {
                    setPendingRoomForPassword(targetRoom);
                    setPasswordModalError('私密房間密碼不正確');
                    setIsPasswordModalOpen(true);
                  }
                }
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
          failureCount++;
          if (failureCount >= 2) {
            // Gracefully fall back to local/broadcast mode when server is unavailable
            setStatus('connected');
            return;
          }
          setStatus('disconnected');
          reconnectTimerRef.current = setTimeout(() => {
            if (isMounted) {
              setStatus('reconnecting');
              connectWebSocket();
            }
          }, 3000);
        };

        ws.onerror = () => {
          // Suppress verbose error logging on static host / missing WS endpoint
        };
      } catch {
        if (isMounted) setStatus('connected');
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
  }, [isStaticHost]);

  // Periodic polling sync for multi-window/multi-browser consistency (skip on static hosts)
  useEffect(() => {
    if (isStaticHost) return;

    let serverAvailable = true;

    const syncServerData = async () => {
      if (!serverAvailable) return;

      try {
        const roomsRes = await fetch('/api/rooms');
        if (roomsRes.ok) {
          const roomList = await roomsRes.json();
          if (Array.isArray(roomList)) {
            setRooms(roomList);
            const totalActive = roomList.reduce((acc, r) => acc + (r.activeUserCount || 0), 0);
            if (totalActive > 0) {
              setOnlineCount((prev) => Math.max(prev, totalActive));
            }
          }
        } else if (roomsRes.status === 404) {
          serverAvailable = false; // Stop polling if backend endpoint 404s
          return;
        }
      } catch {
        // Silently ignore network errors
      }

      if (currentRoomId && serverAvailable) {
        try {
          const msgsRes = await fetch(`/api/rooms/${currentRoomId}/messages`);
          if (msgsRes.ok) {
            const fetchedMsgs = await msgsRes.json();
            if (Array.isArray(fetchedMsgs) && fetchedMsgs.length > 0) {
              setAllRoomMessages((prev) => {
                const currentMsgs = prev[currentRoomId] || [];
                if (
                  currentMsgs.length === fetchedMsgs.length &&
                  currentMsgs[currentMsgs.length - 1]?.id === fetchedMsgs[fetchedMsgs.length - 1]?.id
                ) {
                  return prev;
                }
                return { ...prev, [currentRoomId]: fetchedMsgs };
              });
            }
          } else if (msgsRes.status === 404) {
            serverAvailable = false;
          }
        } catch {
          // Silently ignore
        }
      }
    };

    syncServerData();
    const syncInterval = setInterval(syncServerData, 4000);
    return () => clearInterval(syncInterval);
  }, [currentRoomId, isStaticHost]);

  // Helper to switch room & send WS join_room
  const enterRoom = (roomId: string, passwordAttempt?: string) => {
    setCurrentRoomId(roomId);
    setTypingUsers([]);

    const targetRoomObj = roomsRef.current.find((r) => r.id === roomId);
    const passwordToPass = passwordAttempt || targetRoomObj?.password;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join_room',
          roomId,
          password: passwordToPass,
          username: userProfile.username,
          avatar: userProfile.avatar
        })
      );
    }
  };

  // Handle switching rooms
  const handleSelectRoom = (roomId: string) => {
    if (roomId === currentRoomId) return;

    const targetRoom = rooms.find((r) => r.id === roomId);
    if (!targetRoom) return;

    // Password verification for private rooms
    if (targetRoom.isPrivate && targetRoom.password && !unlockedRoomIds.includes(roomId)) {
      setPendingRoomForPassword(targetRoom);
      setPasswordModalError('');
      setIsPasswordModalOpen(true);
      return;
    }

    enterRoom(roomId);
  };

  // Confirm password entered in modal
  const handleConfirmRoomPassword = (enteredPassword: string) => {
    if (!pendingRoomForPassword) return;

    if (enteredPassword === pendingRoomForPassword.password) {
      const roomId = pendingRoomForPassword.id;
      setUnlockedRoomIds((prev) => {
        if (prev.includes(roomId)) return prev;
        const next = [...prev, roomId];
        try { localStorage.setItem(LOCAL_STORAGE_UNLOCKED_ROOMS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });

      setIsPasswordModalOpen(false);
      enterRoom(roomId, enteredPassword);
      setPendingRoomForPassword(null);
      setPasswordModalError('');
    } else {
      setPasswordModalError('密碼錯誤，請重新輸入');
    }
  };

  // Handle message sending
  const handleSendMessage = async (payload: {
    text: string;
    msgType: 'text' | 'image' | 'video' | 'code' | 'file';
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

    // 1. Optimistic UI update locally
    setAllRoomMessages((prev) => {
      const roomMsgs = prev[currentRoomId] || [];
      if (roomMsgs.some((m) => m.id === newMsg.id)) return prev;
      const updated = [...roomMsgs, newMsg];
      const next = { ...prev, [currentRoomId]: updated };
      try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    setRooms((prev) => {
      const next = prev.map((r) => {
        if (r.id === currentRoomId) {
          return {
            ...r,
            lastMessage:
              newMsg.type === 'image'
                ? '[📷 圖片]'
                : newMsg.type === 'video'
                ? '[🎥 影片]'
                : newMsg.type === 'code'
                ? '[💻 程式碼]'
                : newMsg.type === 'file'
                ? `[📎 檔案] ${newMsg.fileName || ''}`
                : newMsg.text,
            lastMessageTime: newMsg.timestamp
          };
        }
        return r;
      });
      try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    // 2. Broadcast via BroadcastChannel & P2P WebRTC mesh (for cross-browser sync on GitHub Pages)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'new_message',
          roomId: currentRoomId,
          message: newMsg
        });
      } catch {}
    }

    if (p2pRef.current) {
      try {
        p2pRef.current.sendMessage(newMsg);
      } catch {}
    }

    // 3. Send via WS if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
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
      } catch (err) {
        console.warn('WS send failed:', err);
      }
    } else if (!isStaticHost) {
      // Safe REST fallback (only for dynamic hosts with server backend)
      try {
        await fetch(`/api/rooms/${currentRoomId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: payload.text,
            msgType: payload.msgType,
            mediaUrl: payload.mediaUrl,
            fileName: payload.fileName,
            codeLang: payload.codeLang,
            replyTo: payload.replyTo,
            userId: userProfile.userId,
            username: userProfile.username,
            avatar: userProfile.avatar
          })
        });
      } catch {
        // Silently ignore REST failures on static hosts
      }
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

    let nextReactions: Record<string, string[]> = {};

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
          nextReactions = reactions;
          return { ...m, reactions };
        }
        return m;
      });
      const next = { ...prev, [currentRoomId]: updated };
      try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'add_reaction',
          roomId: currentRoomId,
          messageId,
          reactions: nextReactions
        });
      } catch {}
    }

    if (p2pRef.current) {
      try {
        p2pRef.current.sendReaction(currentRoomId, messageId, nextReactions);
      } catch {}
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'add_reaction',
            roomId: currentRoomId,
            messageId,
            emoji
          })
        );
      } catch {}
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
    const newRoomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
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

    // 1. Instantly update local state & localStorage
    setRooms((prev) => {
      const updated = [newRoom, ...prev];
      try { localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    setAllRoomMessages((prev) => {
      const updated = { ...prev, [newRoomId]: [welcomeMsg] };
      try { localStorage.setItem(LOCAL_STORAGE_MSGS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 2. Switch to new room & unlock created room
    setUnlockedRoomIds((prev) => {
      if (prev.includes(newRoomId)) return prev;
      const next = [...prev, newRoomId];
      try { localStorage.setItem(LOCAL_STORAGE_UNLOCKED_ROOMS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    enterRoom(newRoomId, roomData.password);
    setIsCreateModalOpen(false);
    setIsSidebarOpen(false);

    // 3. Broadcast via BroadcastChannel & P2P WebRTC
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'create_room',
          room: newRoom,
          welcomeMsg
        });
      } catch {}
    }

    if (p2pRef.current) {
      try {
        p2pRef.current.broadcastRoom(newRoom, welcomeMsg);
      } catch {}
    }

    // 4. Send to WS server if available
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'create_room',
            id: newRoomId,
            ...roomData
          })
        );
      } catch {}
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
        isStaticHost={isStaticHost}
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

      {/* Room Password Verification Modal */}
      <RoomPasswordModal
        isOpen={isPasswordModalOpen}
        room={pendingRoomForPassword}
        errorMsg={passwordModalError}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPendingRoomForPassword(null);
          setPasswordModalError('');
        }}
        onConfirm={handleConfirmRoomPassword}
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

