export interface Room {
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
  activeUserCount?: number;
  unreadCount?: number;
}

export interface ReplyRef {
  id: string;
  username: string;
  text: string;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'code' | 'file';
  mediaUrl?: string;
  fileName?: string;
  codeLang?: string;
  replyTo?: ReplyRef;
  timestamp: number;
  reactions: Record<string, string[]>; // emoji -> array of userIds
}

export interface UserProfile {
  userId: string;
  username: string;
  avatar: string;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export type CategoryFilter = '全部' | '綜合' | '技術' | '娛樂' | '休閒' | '自訂';
