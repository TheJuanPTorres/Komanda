// Rutas de autenticación. La sesión se transporta en un JWT dentro de una
// cookie httpOnly firmada (expira a las 12h). El PIN solo lo usa el admin.
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { LoginResp, Sesion } from '@pos/shared';
import { config } from '../../config.js';
import { errores } from '../../lib/errores.js';
import { verificarPin } from '../../lib/pin.js';
import { requiereSesion } from './middleware.js';
import { buscarAdmin, buscarPorId } from './servicio.js';

const loginAdminSchema = z.object({
  pin: z.string().min(1, 'Escribe tu PIN.')
});

const loginAuxiliarSchema = z.object({
  usuarioId: z.number().int().positive('Selecciona un auxiliar válido.')
});

// Opciones de la cookie de sesión, centralizadas para setear y borrar igual.
const opcionesCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: config.entorno === 'production',
  maxAge: config.sesionHoras * 60 * 60 // en segundos
};

export async function rutasAuth(app: FastifyInstance): Promise<void> {
  // Emite el JWT y lo guarda en la cookie httpOnly.
  function iniciarSesion(reply: FastifyReply, sesion: Sesion): LoginResp {
    const token = app.jwt.sign(sesion, { expiresIn: `${config.sesionHoras}h` });
    reply.setCookie(config.cookieSesion, token, opcionesCookie);
    return { usuario: sesion };
  }

  // POST /api/auth/admin — login del administrador con PIN.
  app.post('/api/auth/admin', async (req, reply) => {
    const { pin } = loginAdminSchema.parse(req.body);
    const admin = buscarAdmin();
    if (!admin || !admin.pin_hash || !verificarPin(pin, admin.pin_hash)) {
      throw errores.pinIncorrecto();
    }
    const sesion: Sesion = { id: admin.id, nombre: admin.nombre, rol: 'admin' };
    return iniciarSesion(reply, sesion);
  });

  // POST /api/auth/auxiliar — login de auxiliar por selección (sin PIN).
  app.post('/api/auth/auxiliar', async (req, reply) => {
    const { usuarioId } = loginAuxiliarSchema.parse(req.body);
    const usuario = buscarPorId(usuarioId);
    if (!usuario || usuario.rol !== 'auxiliar' || usuario.activo !== 1) {
      throw errores.usuarioInvalido();
    }
    const sesion: Sesion = { id: usuario.id, nombre: usuario.nombre, rol: 'auxiliar' };
    return iniciarSesion(reply, sesion);
  });

  // GET /api/auth/sesion — devuelve el usuario de la sesión actual o 401.
  app.get('/api/auth/sesion', { preHandler: requiereSesion }, async (req) => {
    const sesion: Sesion = {
      id: req.user.id,
      nombre: req.user.nombre,
      rol: req.user.rol
    };
    return { usuario: sesion } satisfies LoginResp;
  });

  // POST /api/auth/salir — cierra la sesión borrando la cookie.
  app.post('/api/auth/salir', async (_req, reply) => {
    reply.clearCookie(config.cookieSesion, { path: '/' });
    return { ok: true };
  });
}
