// Rutas del explorador de ventas (v1.5-B, Parte 2). Solo admin, solo lectura.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FiltroVentas } from '@pos/shared';
import { requiereRol } from '../auth/middleware.js';
import { detalleVenta, exportarVentasCsv, listarVentas, pulsoDelDia } from './servicio.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filtroSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  auxiliar_id: z.coerce.number().int().positive().optional(),
  producto_id: z.coerce.number().int().positive().optional(),
  metodo: z.enum(['efectivo', 'qr_breb']).optional(),
  tipo: z.enum(['mesa', 'barra']).optional(),
  estado: z.enum(['cobrado', 'cancelado']).optional(),
  // Los booleanos llegan como texto en el query string.
  con_correcciones: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().max(40).optional()
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function filtroDesdeQuery(query: unknown): FiltroVentas {
  return filtroSchema.parse(query);
}

export async function rutasVentas(app: FastifyInstance): Promise<void> {
  app.get('/api/ventas', { preHandler: requiereRol('admin') }, async (req) => {
    return listarVentas(filtroDesdeQuery(req.query));
  });

  // Pulso del día: franja en vivo del panel admin (carga inicial).
  app.get('/api/pulso', { preHandler: requiereRol('admin') }, async () => {
    return pulsoDelDia();
  });

  // Exportación CSV del filtro activo. Rate-limit propio (evita descargas masivas).
  app.get(
    '/api/ventas.csv',
    { preHandler: requiereRol('admin'), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const csv = exportarVentasCsv(filtroDesdeQuery(req.query));
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="ventas.csv"');
      return csv;
    }
  );

  app.get('/api/ventas/:id', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    return detalleVenta(id);
  });
}
