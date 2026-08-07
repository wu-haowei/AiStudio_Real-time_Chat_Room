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
  private pingTimer: any = null;

  constructor(callbacks: P2PCallbacks) {
    this.callbacks = callbacks;
  }

  public joinRoom(roomId: string, userId: string) {
    this.leaveRoom();
    this.currentRoomId = roomId;
    this.userId = userId;

    const cleanRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const hostPeerId = `pwa_room_host_${cleanRoomId}`;
    const clientPeerId = `pwa_peer_${userId}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. First try to become the Room Host
    this.tryBecomeHost(hostPeerId, clientPeerId);
  }

  private tryBecomeHost(hostPeerId: string, clientPeerId: string) {
    try {
      const hostPeer = new Peer(hostPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      let hostFailed = false;

      hostPeer.on('open', () => {
        if (hostFailed) return;
        this.peer = hostPeer;
        this.isHost = true;
        this.callbacks.onPeerCountChange(1);

        this.peer.on('connection', (conn) => {
          this.connections.set(conn.peer, conn);
          this.setupConnectionHandlers(conn);
          this.callbacks.onPeerCountChange(this.connections.size + 1);
        });

        this.startPresencePing();
      });

      hostPeer.on('error', (err) => {
        if (hostFailed) return;
        hostFailed = true;

        try {
          hostPeer.destroy();
        } catch {}

        // If ID is already taken, another device is host -> Join as client
        this.joinAsClient(clientPeerId, hostPeerId);
      });
    } catch {
      this.joinAsClient(clientPeerId, hostPeerId);
    }
  }

  private joinAsClient(clientPeerId: string, hostPeerId: string) {
    try {
      const clientPeer = new Peer(clientPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer = clientPeer;
      this.isHost = false;

      clientPeer.on('open', () => {
        this.connectToHost(hostPeerId);
        this.startPresencePing();
      });

      clientPeer.on('error', () => {
        // Silently handle error
      });
    } catch {
      // Ignore
    }
  }

  private connectToHost(hostPeerId: string) {
    if (!this.peer || this.peer.destroyed) return;

    try {
      const conn = this.peer.connect(hostPeerId, { reliable: true });
      this.hostConnection = conn;

      conn.on('open', () => {
        this.setupConnectionHandlers(conn);
        this.callbacks.onPeerCountChange(2);
      });

      conn.on('close', () => {
        this.hostConnection = null;
        this.callbacks.onPeerCountChange(1);
        // Retry joining room to see if we can become new host
        setTimeout(() => {
          if (this.currentRoomId) {
            this.joinRoom(this.currentRoomId, this.userId);
          }
        }, 2000);
      });

      conn.on('error', () => {
        this.hostConnection = null;
      });
    } catch {
      // Ignore
    }
  }

  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'p2p_message' && data.message) {
        this.callbacks.onMessage(data.message);
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

    conn.on('error', () => {
      this.connections.delete(conn.peer);
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
    }, 5000);
  }

  public sendMessage(message: Message) {
    const payload = { type: 'p2p_message', message };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch {}
    }
  }

  public sendReaction(roomId: string, messageId: string, reactions: Record<string, string[]>) {
    const payload = { type: 'p2p_reaction', roomId, messageId, reactions };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch {}
    }
  }

  public broadcastRoom(room: Room, welcomeMsg?: Message) {
    const payload = { type: 'p2p_create_room', room, welcomeMsg };
    if (this.isHost) {
      this.broadcastToOthers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(payload);
      } catch {}
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
    this.connections.forEach((conn) => {
      try { conn.close(); } catch {}
    });
    this.connections.clear();
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch {}
      this.hostConnection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.isHost = false;
  }
}
