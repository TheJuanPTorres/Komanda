// Rutas de usuarios. La lista de auxiliares para la pantalla de acceso es
// pública; la administración de auxiliares (crear/renombrar/desactivar/PIN) es
// solo para el admin. En internet público cada auxiliar tiene PIN de 4 dígitos.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Usuario } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { requiereRol } from './middleware.js';
import {
  asignarPinAuxiliar,
  buscarAuxiliar,
  buscarPorId,
  crearAuxiliar,
  desactivarAuxiliar,
  limpiarIntentos,
  listarAuxiliaresActivos,
  renombrarAuxiliar
} from './servicio.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const pin4 = z.string().regex(/^\d{4}$/, 'El PIN del auxiliar debe ser de 4 dígitos.');

// Crear: nombre + PIN obligatorio. Renombrar: solo nombre.
const crearAuxiliarSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(40),
  pin: pin4
});
const renombrarSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(40)
});
const asignarPinSchema = z.object({ pin: pin4 });

export async function rutasUsuarios(app: FastifyInstance): Promise<void> {
  // GET /api/usuarios/auxiliares — lista de auxiliares activos (público).
  app.get('/api/usuarios/auxiliares', async () => {
    return { auxiliares: listarAuxiliaresActivos() satisfies Usuario[] };
  });

  // POST /api/usuarios/auxiliares — crear auxiliar con PIN (admin).
  app.post('/api/usuarios/auxiliares', { preHandler: requiereRol('admin') }, async (req, reply) => {
    const { nombre, pin } = crearAuxiliarSchema.parse(req.body);
    const auxiliar = crearAuxiliar(nombre, pin);
    if (!auxiliar) throw errores.nombreEnUso();
    return reply.status(201).send({ auxiliar });
  });

  // PATCH /api/usuarios/auxiliares/:id — renombrar auxiliar (admin).
  app.patch('/api/usuarios/auxiliares/:id', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    if (!buscarAuxiliar(id)) throw errores.noEncontrado('Ese auxiliar no existe.');
    const { nombre } = renombrarSchema.parse(req.body);
    const auxiliar = renombrarAuxiliar(id, nombre);
    if (!auxiliar) throw errores.nombreEnUso();
    return { auxiliar };
  });

  // PUT /api/usuarios/auxiliares/:id/pin — asignar/restablecer PIN (admin).
  app.put('/api/usuarios/auxiliares/:id/pin', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    if (!buscarAuxiliar(id)) throw errores.noEncontrado('Ese auxiliar no existe.');
    const { pin } = asignarPinSchema.parse(req.body);
    asignarPinAuxiliar(id, pin);
    return { ok: true };
  });

  // DELETE /api/usuarios/auxiliares/:id — desactivar auxiliar (admin).
  app.delete('/api/usuarios/auxiliares/:id', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    if (!buscarAuxiliar(id)) throw errores.noEncontrado('Ese auxiliar no existe.');
    desactivarAuxiliar(id);
    return { ok: true };
  });

  // POST /api/usuarios/:id/desbloquear — limpia el contador de bloqueo por
  // cuenta al instante (admin). Sirve para cualquier usuario (auxiliar o la
  // propia cuenta admin): si alguien falla 8 PIN a propósito en hora pico, el
  // admin lo libera sin esperar los 15 minutos.
  app.post(
    '/api/usuarios/:id/desbloquear',
    { preHandler: requiereRol('admin'), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const usuario = buscarPorId(id);
      if (!usuario || usuario.activo !== 1) throw errores.noEncontrado('Esa cuenta no existe.');
      limpiarIntentos(id);
      return { ok: true };
    }
  );
}
