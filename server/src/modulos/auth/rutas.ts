// Rutas de autenticación. La sesión viaja en un JWT dentro de una cookie
// httpOnly (secure+lax en producción), expira a las 12 h.
//
// Seguridad (internet público):
//  - Rate limit por IP: admin 5/15min, auxiliar 20/min.
//  - Bloqueo por CUENTA persistido en DB: 8 fallos en 15 min → 429 (cambiar de
//    IP no reinicia el contador; sobrevive a reinicios).
//  - PIN admin ≥ 6 dígitos; si el vigente es corto, se fuerza a renovarlo.
//  - PIN de auxiliar obligatorio (4 dígitos), asignado por el admin.
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { LoginResp, Sesion } from '@pos/shared';
import { config } from '../../config.js';
import { errores } from '../../lib/errores.js';
import { verificarPin } from '../../lib/pin.js';
import { requiereSesion } from './middleware.js';
import {
  buscarAdmin,
  buscarPorId,
  cambiarPinUsuario,
  cuentaBloqueada,
  limpiarIntentos,
  registrarIntentoFallido
} from './servicio.js';

const loginAdminSchema = z.object({ pin: z.string().min(1, 'Escribe tu PIN.') });
const loginAuxiliarSchema = z.object({
  usuarioId: z.number().int().positive('Selecciona un auxiliar válido.'),
  pin: z.string().min(1, 'Escribe tu PIN.')
});
// Solo dígitos; la longitud exacta se valida por rol en el handler.
const cambiarPinSchema = z.object({
  pin_nuevo: z.string().regex(/^\d+$/, 'El PIN son solo dígitos.')
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
  app.post(
    '/api/auth/admin',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const { pin } = loginAdminSchema.parse(req.body);
      const admin = buscarAdmin();
      // No revelar si el admin existe: mismo error que PIN incorrecto.
      if (!admin) throw errores.pinIncorrecto();
      if (cuentaBloqueada(admin.id)) throw errores.demasiadosIntentos();
      if (!admin.pin_hash || !verificarPin(pin, admin.pin_hash)) {
        registrarIntentoFallido(admin.id);
        throw errores.pinIncorrecto();
      }
      limpiarIntentos(admin.id);
      const sesion: Sesion = { id: admin.id, nombre: admin.nombre, rol: 'admin' };
      const resp = iniciarSesion(reply, sesion);
      return { ...resp, debe_cambiar_pin: admin.debe_cambiar_pin === 1 };
    }
  );

  // POST /api/auth/auxiliar — login de auxiliar con nombre (id) + PIN.
  app.post(
    '/api/auth/auxiliar',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { usuarioId, pin } = loginAuxiliarSchema.parse(req.body);
      const usuario = buscarPorId(usuarioId);
      if (!usuario || usuario.rol !== 'auxiliar' || usuario.activo !== 1) {
        throw errores.usuarioInvalido();
      }
      if (!usuario.pin_hash) throw errores.auxiliarSinPin();
      if (cuentaBloqueada(usuario.id)) throw errores.demasiadosIntentos();
      if (!verificarPin(pin, usuario.pin_hash)) {
        registrarIntentoFallido(usuario.id);
        throw errores.pinIncorrecto();
      }
      limpiarIntentos(usuario.id);
      const sesion: Sesion = { id: usuario.id, nombre: usuario.nombre, rol: 'auxiliar' };
      const resp = iniciarSesion(reply, sesion);
      return { ...resp, debe_cambiar_pin: usuario.debe_cambiar_pin === 1 };
    }
  );

  // POST /api/auth/cambiar-pin — el usuario de la sesión define su PIN nuevo.
  // Admin: ≥ 6 dígitos; auxiliar: exactamente 4. Baja debe_cambiar_pin.
  app.post('/api/auth/cambiar-pin', { preHandler: requiereSesion }, async (req) => {
    const { pin_nuevo } = cambiarPinSchema.parse(req.body);
    if (req.user.rol === 'admin') {
      if (pin_nuevo.length < 6) throw errores.pinCorto(6);
    } else if (pin_nuevo.length !== 4) {
      throw errores.pinCorto(4);
    }
    cambiarPinUsuario(req.user.id, pin_nuevo);
    return { ok: true };
  });

  // GET /api/auth/sesion — usuario de la sesión actual (o 401). Incluye si
  // todavía debe renovar su PIN (admin o auxiliar).
  app.get('/api/auth/sesion', { preHandler: requiereSesion }, async (req) => {
    const actual = buscarPorId(req.user.id);
    const sesion: Sesion = { id: req.user.id, nombre: req.user.nombre, rol: req.user.rol };
    return {
      usuario: sesion,
      debe_cambiar_pin: actual?.debe_cambiar_pin === 1
    } satisfies LoginResp;
  });

  // POST /api/auth/salir — cierra la sesión borrando la cookie.
  app.post('/api/auth/salir', async (_req, reply) => {
    reply.clearCookie(config.cookieSesion, { path: '/' });
    return { ok: true };
  });
}
