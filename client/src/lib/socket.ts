/**
 * BeCare Socket client shim.
 * The visitor flow now persists data through the PostgreSQL-backed REST API.
 * Real-time updates are now supported through SSE for visitor status updates.
 */

import { io, Socket } from 'socket.io-client';

const _rawSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
const SOCKET_URL = _rawSocketUrl || (typeof window !== 'undefined' ? window.location.origin : '');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: false,
      path: '/socket.io',
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function visitorJoin(_visitorId: string): void {
  // Persistence is now handled through the REST API.
}

export function visitorUpdatePage(_visitorId: string, _page: string, _step?: string): void {
  // Persistence is now handled through the REST API.
}

export function visitorSaveData(_visitorId: string, _payload: Record<string, any>): void {
  // Persistence is now handled through the REST API.
}

export function visitorHeartbeat(_visitorId: string): void {
  // Persistence is now handled through the REST API.
}

export function visitorSendMessage(_visitorId: string, _message: string, _senderName?: string): void {
  // Persistence is now handled through the REST API.
}

export function onVisitorRedirect(_callback: (data: { targetPage: string }) => void): () => void {
  return () => undefined;
}

export function onVisitorStatusUpdated(callback: (data: any) => void): () => void {
  const visitorId = localStorage.getItem("visitor");
  if (!visitorId) {
    console.log("[Socket] No visitor ID found for status updates");
    return () => undefined;
  }
  
  console.log("[Socket] Connecting to visitor SSE stream for:", visitorId);
  
  const eventSource = new EventSource(`/api/visitor/${visitorId}/stream`);
  
  eventSource.addEventListener("status_update", (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("[Socket] Status update received:", data);
      callback(data);
    } catch (e) {
      console.error("[Socket] Error parsing status update:", e);
    }
  });
  
  eventSource.onerror = (err) => {
    console.error("[Socket] SSE error:", err);
  };
  
  return () => {
    console.log("[Socket] Closing visitor SSE stream");
    eventSource.close();
  };
}

export function onVisitorNewMessage(_callback: (data: any) => void): () => void {
  return () => undefined;
}

export function onVisitorBlocked(_callback: () => void): () => void {
  return () => undefined;
}
