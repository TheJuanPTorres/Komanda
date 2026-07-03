// Socket.IO del lado cliente. Un único socket para toda la app.
// Se conecta al mismo origen (en dev, Vite proxya /socket.io al servidor).
// La cookie de sesión viaja sola por ser mismo origen.
import { io, type Socket } from 'socket.io-client';

export const socket: Socket = io({
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket']
});

export function conectarSocket(): void {
  if (!socket.connected) socket.connect();
}

export function desconectarSocket(): void {
  if (socket.connected) socket.disconnect();
}
