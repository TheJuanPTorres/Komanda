// Rutas del cierre de caja. Solo admin (cerrar la caja es acción de caja).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CierrePreview } from '@pos/shared';
import { requiereRol } from '../auth/middleware.js';
import { previsualizarCierre, registrarCierre } from './servicio.js';

const cierreSchema = z.object({
  base_inicial: z.number().int().min(0, 'La base no puede ser negativa.'),
  efectivo_contado: z.number().int().min(0, 'El efectivo contado no puede ser negativo.'),
  nota: z.string().trim().max(200).optional()
});

export async function rutasCierreCaja(app: FastifyInstance): Promise<void> {
  // GET /api/cierre-caja/hoy — agregados del día (o el cierre ya hecho).
  app.get('/api/cierre-caja/hoy', { preHandler: requiereRol('admin') }, async () => {
    return { preview: previsualizarCierre() satisfies CierrePreview };
  });

  // POST /api/cierre-caja — registra el cierre de hoy (uno por día).
  app.post('/api/cierre-caja', { preHandler: requiereRol('admin') }, async (req, reply) => {
    const datos = cierreSchema.parse(req.body);
    const cierre = registrarCierre(datos, req.user.id);
    return reply.status(201).send({ cierre });
  });
}
