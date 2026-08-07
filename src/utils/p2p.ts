import { Peer, DataConnection } from 'peerjs';
import { Message, Room } from '../types';

export interface P2PCallbacks {
  onMessage: (msg: Message) => void;
  onReaction: (roomId: string, messageId: string, reactions: Record<string, string[]>) => void;
  onCreateRoom: (room: Room, welcomeMsg?: Message) => void;
  onPeerCountChange: (count: number) => void;
}

export class P2PManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private isHost: boolean = false;
  private currentRoomId: string = '';
  private userId: string = '';
  private callbacks: P2PCallbacks;
  private reconnectTimer: any = null;
  private pingTimer: any = null;

  constructor(callbacks: P2PCallbacks) {
    this.callbacks = callbacks;
  }

  public joinRoom(roomId: string, userId: string) {
    this.leaveRoom();
    this.currentRoomId = roomId;
    this.userId = userId;

    // Sanitize room ID for PeerJS ID format
    const sanitizedRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const primaryHostId = `pwa_chat_room_host_${sanitizedRoomId}`;

    // Try becoming host for this room
    this.tryBecomeHost(primaryHostId);
  }

  private tryBecomeHost(hostId: string) {
    this.peer = new Peer(hostId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', () => {
      console.log(`[P2P] Room host registered: ${hostId}`);
      this.isHost = true;
      this.callbacks.onPeerCountChange(this.connections.size + 1);
      this.startPresencePing();
    });

    this.peer.on('connection', (conn) => {
      console.log(`[P2P] Peer connected to host: ${conn.peer}`);
      this.connections.set(conn.peer, conn);
      this.setupConnectionHandlers(conn);
      this.callbacks.onPeerCountChange(this.connections.size + 1);
    });

    this.peer.on('error', (err: any) => {
      // If host ID is already taken by another device, join as client
      if (err.type === 'unavailable-id') {
        console.log(`[P2P] Host ID taken. Joining as client connection to: ${hostId}`);
        this.joinAsClient(hostId);
      } else {
        console.warn('[P2P] PeerJS error:', err);
      }
    });
  }

  private joinAsClient(hostId: string) {
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }

    const clientPeerId = `pwa_client_${this.userId}_${Math.random().toString(36).substring(2, 7)}`;
    this.peer = new Peer(clientPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', () => {
      console.log(`[P2P] Client peer active: ${clientPeerId}. Connecting to host: ${hostId}`);
      this.connectToHost(hostId);
    });

    this.peer.on('error', (err) => {
      console.warn('[P2P] Client peer error:', err);
    });
  }

  private connectToHost(hostId: string) {
    if (!this.peer || this.peer.destroyed) return;

    const conn = this.peer.connect(hostId, { reliable: true });
    this.hostConnection = conn;

    conn.on('open', () => {
      console.log(`[P2P] Connected to host ${hostId} successfully!`);
      this.setupConnectionHandlers(conn);
      this.callbacks.onPeerCountChange(2); // host + self
      this.startPresencePing();
    });

    conn.on('close', () => {
      console.log('[P2P] Host disconnected. Attempting to become new host...');
      this.hostConnection = null;
      this.callbacks.onPeerCountChange(1);
      
      // Retry becoming host
      const sanitizedRoomId = this.currentRoomId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const primaryHostId = `pwa_chat_room_host_${sanitizedRoomId}`;
      setTimeout(() => {
        this.tryBecomeHost(primaryHostId);
      }, 1000);
    });

    conn.on('error', (err) => {
      console.warn('[P2P] Host connection error:', err);
    });
  }

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'p2p_message' && data.message) {
        this.callbacks.onMessage(data.message);
        // If host, forward to all other clients
        if (this.isHost) {
          this.broadcastToOthers(data, conn.peer);
        }
      }

      if (data.type === 'p2p_reaction' && data.roomId && data.messageId && data.reactions) {
        this.callbacks.onReaction(data.roomId, data.messageId, data.reactions);
        if (this.isHost) {
          this.broadcastToOthers(data, conn.peer);
        }
      }

      if (data.type === 'p2p_create_room' && data.room) {
        this.callbacks.onCreateRoom(data.room, data.welcomeMsg);
        if (this.isHost) {
          this.broadcastToOthers(data, conn.peer);
        }
      }

      if (data.type === 'p2p_ping') {
        // Respond with pong
        try {
          conn.send({ type: 'p2p_pong', timestamp: Date.now() });
        } catch {}
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.isHost) {
        this.callbacks.onPeerCountChange(this.connections.size + 1);
      }
    });
  }

  private startPresencePing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      const pingPayload = { type: 'p2p_ping', timestamp: Date.now() };
      if (this.isHost) {
        this.broadcastToOthers(pingPayload);
      } else if (this.hostConnection && this.hostConnection.open) {
        try {
          this.hostConnection.send(pingPayload);
        } catch {}
      }
    }, 4000);
  }

  public sendMessage(message: Message) {
    const payload = { type: 'p2p_message', message };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch (e) {
        console.warn('[P2P] Failed to send message via WebRTC:', e);
      }
    }
  }

  public sendReaction(roomId: string, messageId: string, reactions: Record<string, string[]>) {
    const payload = { type: 'p2p_reaction', roomId, messageId, reactions };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch (e) {
        console.warn('[P2P] Failed to send reaction via WebRTC:', e);
      }
    }
  }

  public broadcastRoom(room: Room, welcomeMsg?: Message) {
    const payload = { type: 'p2p_create_room', room, welcomeMsg };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch (e) {
        console.warn('[P2P] Failed to broadcast room via WebRTC:', e);
      }
    }
  }

  private broadcastToOthers(payload: any, excludePeerId?: string) {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        try {
          conn.send(payload);
        } catch {}
      }
    });
  }

  public leaveRoom() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
  }
}
