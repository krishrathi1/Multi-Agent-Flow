import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      // Vercel's `/socket.io/:path*` rewrite doesn't match the bare
      // `/socket.io/` the client requests by default, so the handshake got the
      // SPA's index.html and real-time updates never connected.
      addTrailingSlash: false,
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(token: string, organizationId?: string) {
  const s = getSocket();
  s.auth = { token, organizationId };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export { socket };
