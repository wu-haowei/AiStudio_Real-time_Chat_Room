import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  type: 'text' | 'image' | 'code' | 'file';
  mediaUrl?: string;
  fileName?: string;
  codeLang?: string;
  replyTo?: {
    id: string;
    username: string;
    text: string;
  };
  timestamp: number;
  reactions: Record<string, string[]>; // emoji -> array of userIds
}

interface Room {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  createdBy: string;
  createdAt: number;
  isPrivate?: boolean;
  password?: string;
  lastMessage?: string;
  lastMessageTime?: number;
}

interface ClientMeta {
  ws: WebSocket;
  userId: string;
  username: string;
  avatar: string;
  currentRoomId: string | null;
}

const app = express();
app.use(express.json({ limit: '10mb' }));

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket HTTP upgrades cleanly
httpServer.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  // Handle WS connection requests on /ws or /
  if (url.pathname === '/ws' || url.pathname === '/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Initial Default Rooms
const rooms: Map<string, Room> = new Map([
  [
    'general',
    {
      id: 'general',
      title: '💬 綜合討論大廳',
      description: '暢所欲言，聊聊生活、興趣與最新時事',
      category: '綜合',
      icon: '💬',
      createdBy: '系統管理員',
      createdAt: Date.now() - 86400000,
      lastMessage: '歡迎大家來到綜合討論大廳！',
      lastMessageTime: Date.now() - 3600000
    }
  ],
  [
    'tech',
    {
      id: 'tech',
      title: '💻 前端與技術交流',
      description: '討論 Web 程式開發、React, TypeScript, PWA 與 AI 應用',
      category: '技術',
      icon: '💻',
      createdBy: '系統管理員',
      createdAt: Date.now() - 72000000,
      lastMessage: '大家今天使用什麼 Web 技術開發 App 呢？',
      lastMessageTime: Date.now() - 1800000
    }
  ],
  [
    'gaming',
    {
      id: 'gaming',
      title: '🎮 遊戲電競熱情區',
      description: '組隊揪團、交流遊戲心得與攻略分享',
      category: '娛樂',
      icon: '🎮',
      createdBy: '系統管理員',
      createdAt: Date.now() - 50000000,
      lastMessage: '今晚有人要一起組隊開黑嗎？',
      lastMessageTime: Date.now() - 900000
    }
  ],
  [
    'music',
    {
      id: 'music',
      title: '🎧 音樂與 Chill 氛圍',
      description: '分享你喜歡的歌單、Podcast 與創作者',
      category: '休閒',
      icon: '🎧',
      createdBy: '系統管理員',
      createdAt: Date.now() - 30000000,
      lastMessage: '推薦大家最近這首很 Chill 的 Lo-Fi 歌曲',
      lastMessageTime: Date.now() - 600000
    }
  ]
]);

// In-Memory Message Storage per Room (up to 200 per room)
const roomMessages: Map<string, Message[]> = new Map([
  [
    'general',
    [
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
    ]
  ],
  [
    'tech',
    [
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
  ]
]);

const clients: Set<ClientMeta> = new Set();

function getActiveRoomUserCount(roomId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.currentRoomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}

function getOnlineUsersCount(): number {
  let count = 0;
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}

function getRoomsListPayload() {
  return Array.from(rooms.values()).map((room) => ({
    ...room,
    activeUserCount: getActiveRoomUserCount(room.id)
  }));
}

function broadcastToAll(data: object) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastToRoom(roomId: string, data: object, excludeWs?: WebSocket) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.currentRoomId === roomId && client.ws !== excludeWs) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

function broadcastRoomList() {
  broadcastToAll({
    type: 'room_list_updated',
    rooms: getRoomsListPayload(),
    onlineUsersCount: getOnlineUsersCount()
  });
}

// WebSocket connection lifecycle
wss.on('connection', (ws) => {
  const meta: ClientMeta = {
    ws,
    userId: 'user_' + Math.random().toString(36).substring(2, 9),
    username: '熱情用戶',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
    currentRoomId: null
  };
  clients.add(meta);

  // Send initial handshake state
  ws.send(
    JSON.stringify({
      type: 'connected_init',
      userId: meta.userId,
      rooms: getRoomsListPayload(),
      onlineUsersCount: clients.size
    })
  );

  broadcastRoomList();

  ws.on('message', (raw) => {
    try {
      const payload = JSON.parse(raw.toString());

      switch (payload.type) {
        case 'set_user_info': {
          if (payload.username) meta.username = payload.username;
          if (payload.avatar) meta.avatar = payload.avatar;
          ws.send(
            JSON.stringify({
              type: 'user_info_updated',
              userId: meta.userId,
              username: meta.username,
              avatar: meta.avatar
            })
          );
          break;
        }

        case 'join_room': {
          const { roomId, username, avatar } = payload;
          if (username) meta.username = username;
          if (avatar) meta.avatar = avatar;

          const targetRoom = rooms.get(roomId);
          if (!targetRoom) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: '找不到該房間'
              })
            );
            return;
          }

          // Leave previous room if any
          if (meta.currentRoomId && meta.currentRoomId !== roomId) {
            broadcastToRoom(meta.currentRoomId, {
              type: 'user_left_room',
              roomId: meta.currentRoomId,
              userId: meta.userId,
              username: meta.username,
              timestamp: Date.now()
            });
          }

          meta.currentRoomId = roomId;

          const history = roomMessages.get(roomId) || [];

          // Notify client of joined room
          ws.send(
            JSON.stringify({
              type: 'joined_room_success',
              room: {
                ...targetRoom,
                activeUserCount: getActiveRoomUserCount(roomId)
              },
              messages: history
            })
          );

          // Broadcast system join notification to others in room
          broadcastToRoom(
            roomId,
            {
              type: 'user_joined_room',
              roomId,
              userId: meta.userId,
              username: meta.username,
              avatar: meta.avatar,
              activeUserCount: getActiveRoomUserCount(roomId),
              timestamp: Date.now()
            },
            ws
          );

          broadcastRoomList();
          break;
        }

        case 'leave_room': {
          if (meta.currentRoomId) {
            const oldRoomId = meta.currentRoomId;
            meta.currentRoomId = null;
            broadcastToRoom(oldRoomId, {
              type: 'user_left_room',
              roomId: oldRoomId,
              userId: meta.userId,
              username: meta.username,
              activeUserCount: getActiveRoomUserCount(oldRoomId),
              timestamp: Date.now()
            });
            broadcastRoomList();
          }
          break;
        }

        case 'send_message': {
          const { roomId, text, msgType, mediaUrl, fileName, codeLang, replyTo } = payload;
          if (!roomId || (!text && !mediaUrl)) return;

          const newMsg: Message = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            roomId,
            userId: meta.userId,
            username: meta.username,
            avatar: meta.avatar,
            text: text || '',
            type: msgType || 'text',
            mediaUrl,
            fileName,
            codeLang,
            replyTo,
            timestamp: Date.now(),
            reactions: {}
          };

          if (!roomMessages.has(roomId)) {
            roomMessages.set(roomId, []);
          }

          const msgs = roomMessages.get(roomId)!;
          msgs.push(newMsg);
          if (msgs.length > 250) {
            msgs.shift(); // Keep latest 250 messages per room
          }

          // Update room info
          const roomObj = rooms.get(roomId);
          if (roomObj) {
            roomObj.lastMessage =
              newMsg.type === 'image'
                ? '[📷 圖片]'
                : newMsg.type === 'code'
                ? '[💻 程式碼]'
                : newMsg.type === 'file'
                ? `[📎 檔案] ${newMsg.fileName || ''}`
                : newMsg.text;
            roomObj.lastMessageTime = newMsg.timestamp;
          }

          // Broadcast message to everyone in room (including sender so client gets official timestamp & ID)
          broadcastToRoom(roomId, {
            type: 'new_message',
            message: newMsg
          });

          // Also broadcast to room list so previews update across app
          broadcastRoomList();
          break;
        }

        case 'typing': {
          const { roomId, isTyping } = payload;
          if (roomId) {
            broadcastToRoom(
              roomId,
              {
                type: 'user_typing',
                roomId,
                userId: meta.userId,
                username: meta.username,
                isTyping
              },
              ws
            );
          }
          break;
        }

        case 'add_reaction': {
          const { roomId, messageId, emoji } = payload;
          if (!roomId || !messageId || !emoji) return;

          const msgs = roomMessages.get(roomId) || [];
          const targetMsg = msgs.find((m) => m.id === messageId);
          if (targetMsg) {
            if (!targetMsg.reactions) targetMsg.reactions = {};
            if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];

            const userIndex = targetMsg.reactions[emoji].indexOf(meta.userId);
            if (userIndex > -1) {
              // Remove reaction
              targetMsg.reactions[emoji].splice(userIndex, 1);
              if (targetMsg.reactions[emoji].length === 0) {
                delete targetMsg.reactions[emoji];
              }
            } else {
              // Add reaction
              targetMsg.reactions[emoji].push(meta.userId);
            }

            broadcastToRoom(roomId, {
              type: 'reaction_updated',
              roomId,
              messageId,
              reactions: targetMsg.reactions
            });
          }
          break;
        }

        case 'create_room': {
          const { id, title, description, category, icon, isPrivate, password } = payload;
          if (!title) return;

          const newRoomId = (id && typeof id === 'string') ? id : ('room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
          const newRoom: Room = {
            id: newRoomId,
            title: title.trim(),
            description: description?.trim() || '無描述',
            category: category || '其他',
            icon: icon || '💬',
            createdBy: meta.username,
            createdAt: Date.now(),
            isPrivate: !!isPrivate,
            password: password || undefined,
            lastMessage: '新創立的房間，快來聊天吧！',
            lastMessageTime: Date.now()
          };

          rooms.set(newRoomId, newRoom);
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
          roomMessages.set(newRoomId, [welcomeMsg]);

          // Join creator into the new room on server side
          if (meta.currentRoomId && meta.currentRoomId !== newRoomId) {
            broadcastToRoom(meta.currentRoomId, {
              type: 'user_left_room',
              roomId: meta.currentRoomId,
              userId: meta.userId,
              username: meta.username,
              timestamp: Date.now()
            });
          }
          meta.currentRoomId = newRoomId;

          ws.send(
            JSON.stringify({
              type: 'room_created_success',
              roomId: newRoomId,
              room: newRoom,
              messages: [welcomeMsg]
            })
          );

          broadcastRoomList();
          break;
        }
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(meta);
    if (meta.currentRoomId) {
      broadcastToRoom(meta.currentRoomId, {
        type: 'user_left_room',
        roomId: meta.currentRoomId,
        userId: meta.userId,
        username: meta.username,
        activeUserCount: getActiveRoomUserCount(meta.currentRoomId),
        timestamp: Date.now()
      });
    }
    broadcastRoomList();
  });
});

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    onlineUsers: clients.size,
    roomsCount: rooms.size,
    timestamp: Date.now()
  });
});

app.get('/api/rooms', (req, res) => {
  res.json(getRoomsListPayload());
});

app.post('/api/rooms', (req, res) => {
  const { title, description, category, icon, createdBy } = req.body;
  if (!title) {
    return res.status(400).json({ error: '房間標題為必填欄位' });
  }

  const roomId = 'room_' + Date.now();
  const newRoom: Room = {
    id: roomId,
    title: title.trim(),
    description: description?.trim() || '無描述',
    category: category || '自訂',
    icon: icon || '💬',
    createdBy: createdBy || '訪客',
    createdAt: Date.now(),
    lastMessage: '房間已建立',
    lastMessageTime: Date.now()
  };

  rooms.set(roomId, newRoom);
  roomMessages.set(roomId, []);

  broadcastRoomList();

  res.json({ success: true, room: newRoom });
});

app.get('/api/rooms/:id/messages', (req, res) => {
  const roomId = req.params.id;
  const msgs = roomMessages.get(roomId) || [];
  res.json(msgs);
});

// Vite & Static file handling
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[ChatServer] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic();
