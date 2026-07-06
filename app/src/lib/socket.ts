// Socket.IO del lado cliente. Un único socket para toda la app.
// Se conecta al MISMO origen (URL relativa): bajo HTTPS usa wss automáticamente.
// La cookie de sesión viaja sola por ser mismo origen.
import { io, type Socket } from 'socket.io-client';

export const socket: Socket = io({
  autoConnect: false,
  withCredentials: true,
  // WebSocket primero; en redes móviles hostiles cae a polling si hace falta.
  transports: ['websocket', 'polling'],
  // Reconexión automática con backoff (internet inestable / datos móviles).
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.5,
  timeout: 10000
});

export function conectarSocket(): void {
  if (!socket.connected) socket.connect();
}

export function desconectarSocket(): void {
  if (socket.connected) socket.disconnect();
}
