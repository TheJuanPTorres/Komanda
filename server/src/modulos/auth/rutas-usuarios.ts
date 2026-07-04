// Rutas de usuarios. La lista de auxiliares para la pantalla de acceso es
// pública; la administración de auxiliares (crear/renombrar/desactivar) es
// solo para el admin.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GuardarAuxiliarReq, Usuario } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { requiereRol } from './middleware.js';
import {
  buscarAuxiliar,
  crearAuxiliar,
  desactivarAuxiliar,
  listarAuxiliaresActivos,
  renombrarAuxiliar
} from './servicio.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const guardarAuxiliarSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(40)
}) satisfies z.ZodType<GuardarAuxiliarReq>;

export async function rutasUsuarios(app: FastifyInstance): Promise<void> {
  // GET /api/usuarios/auxiliares — lista de auxiliares activos (público).
  app.get('/api/usuarios/auxiliares', async () => {
    return { auxiliares: listarAuxiliaresActivos() satisfies Usuario[] };
  });

  // POST /api/usuarios/auxiliares — crear auxiliar (admin).
  app.post('/api/usuarios/auxiliares', { preHandler: requiereRol('admin') }, async (req, reply) => {
    const { nombre } = guardarAuxiliarSchema.parse(req.body);
    const auxiliar = crearAuxiliar(nombre);
    if (!auxiliar) throw errores.nombreEnUso();
    return reply.status(201).send({ auxiliar });
  });

  // PATCH /api/usuarios/auxiliares/:id — renombrar auxiliar (admin).
  app.patch('/api/usuarios/auxiliares/:id', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    if (!buscarAuxiliar(id)) throw errores.noEncontrado('Ese auxiliar no existe.');
    const { nombre } = guardarAuxiliarSchema.parse(req.body);
    const auxiliar = renombrarAuxiliar(id, nombre);
    if (!auxiliar) throw errores.nombreEnUso();
    return { auxiliar };
  });

  // DELETE /api/usuarios/auxiliares/:id — desactivar auxiliar (admin).
  app.delete('/api/usuarios/auxiliares/:id', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    if (!buscarAuxiliar(id)) throw errores.noEncontrado('Ese auxiliar no existe.');
    desactivarAuxiliar(id);
    return { ok: true };
  });
}
