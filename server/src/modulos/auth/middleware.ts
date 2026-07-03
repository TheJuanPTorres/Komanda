// Middlewares de autenticación/autorización reutilizables.
// Se usan como preHandler en las rutas que lo requieran.
//
// IMPORTANTE (regla sagrada del negocio): la validación de rol vive en el
// servidor. requiereRol('admin') es la barrera que protege cobrar/cerrar.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Rol } from '@pos/shared';
import { errores } from '../../lib/errores.js';

/**
 * Exige una sesión válida. Verifica el JWT que viaja en la cookie httpOnly
 * (configurada en @fastify/jwt) y deja el usuario en request.user.
 */
export async function requiereSesion(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw errores.noAutenticado();
  }
}

/**
 * Exige una sesión válida Y que el rol sea el indicado. Úsese para proteger
 * acciones de admin (cobros, cierre de caja…).
 */
export function requiereRol(rol: Rol) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requiereSesion(req, reply);
    if (req.user.rol !== rol) {
      throw errores.sinPermiso();
    }
  };
}
