// Rutas de correcciones (v1.5-B). El auxiliar solicita; el admin resuelve.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SolicitudCorreccion } from '@pos/shared';
import { requiereRol, requiereSesion } from '../auth/middleware.js';
import {
  aprobarCorreccion,
  listarPendientes,
  pendientesDePedido,
  rechazarCorreccion,
  solicitarCorreccion
} from './servicio.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const itemParams = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive()
});
const solicitarSchema = z.object({
  tipo: z.enum(['reducir', 'eliminar']),
  cantidad_nueva: z.number().int().positive().max(99).optional(),
  motivo: z.string().max(120).optional()
});

export async function rutasCorrecciones(app: FastifyInstance): Promise<void> {
  // POST /api/pedidos/:id/items/:itemId/correccion — el auxiliar solicita.
  app.post(
    '/api/pedidos/:id/items/:itemId/correccion',
    { preHandler: requiereSesion },
    async (req, reply) => {
      const { id, itemId } = itemParams.parse(req.params);
      const { tipo, cantidad_nueva, motivo } = solicitarSchema.parse(req.body);
      const solicitud = solicitarCorreccion(id, itemId, tipo, cantidad_nueva, motivo ?? '', req.user.id);
      return reply.status(201).send({ solicitud });
    }
  );

  // GET /api/pedidos/:id/correcciones — pendientes de un pedido (para el
  // distintivo ámbar del item y el flujo de cobro). Cualquier sesión.
  app.get('/api/pedidos/:id/correcciones', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    return { solicitudes: pendientesDePedido(id) satisfies SolicitudCorreccion[] };
  });

  // GET /api/correcciones — todas las pendientes (admin). Alimenta el badge y la
  // sección CORRECCIONES.
  app.get('/api/correcciones', { preHandler: requiereRol('admin') }, async () => {
    return { solicitudes: listarPendientes() satisfies SolicitudCorreccion[] };
  });

  // POST /api/correcciones/:id/aprobar — el admin ejecuta la corrección.
  app.post('/api/correcciones/:id/aprobar', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const solicitud = aprobarCorreccion(id, req.user.id, req.user.nombre);
    return { solicitud };
  });

  // POST /api/correcciones/:id/rechazar — el admin rechaza; el item queda igual.
  app.post('/api/correcciones/:id/rechazar', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const solicitud = rechazarCorreccion(id, req.user.id, req.user.nombre);
    return { solicitud };
  });
}
