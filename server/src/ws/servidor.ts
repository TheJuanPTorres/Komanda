// Arranque de Socket.IO montado sobre el servidor HTTP de Fastify.
// El socket se autentica con la MISMA cookie de sesión que la API REST:
// leemos la cookie del handshake, verificamos el JWT y guardamos la sesión.
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Sesion } from '@pos/shared';
import { config } from '../config.js';
import { registrarIo } from './emisor.js';

export function iniciarWebsockets(app: FastifyInstance): Server {
  const io = new Server(app.server, {
    // Mismo origen en producción; en dev el proxy de Vite reenvía a /socket.io.
    cors: { origin: true, credentials: true }
  });

  // Middleware de autenticación del socket.
  io.use((socket, next) => {
    try {
      const cookies = app.parseCookie(socket.handshake.headers.cookie ?? '');
      const token = cookies[config.cookieSesion];
      if (!token) {
        next(new Error('NO_AUTENTICADO'));
        return;
      }
      // Verifica el JWT con el mismo secreto/plugin que la API.
      const sesion = app.jwt.verify<Sesion>(token);
      socket.data.sesion = sesion;
      next();
    } catch {
      next(new Error('NO_AUTENTICADO'));
    }
  });

  io.on('connection', (socket) => {
    const sesion = socket.data.sesion as Sesion | undefined;
    app.log.info({ usuario: sesion?.nombre, rol: sesion?.rol }, 'socket conectado');
    socket.on('disconnect', () => {
      app.log.info({ usuario: sesion?.nombre }, 'socket desconectado');
    });
  });

  registrarIo(io);
  return io;
}
