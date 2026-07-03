// Rutas de reportes. Solo admin (información de gestión del negocio).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ReporteMargen, ReporteVentas } from '@pos/shared';
import { requiereRol } from '../auth/middleware.js';
import { reporteMargen, reporteVentas } from './servicio.js';

// Valida un rango de fechas YYYY-MM-DD con desde <= hasta.
const rangoSchema = z
  .object({
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha "desde" inválida.'),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha "hasta" inválida.')
  })
  .refine((r) => r.desde <= r.hasta, {
    message: 'El rango de fechas está al revés.'
  });

export async function rutasReportes(app: FastifyInstance): Promise<void> {
  // GET /api/reportes/margen?desde=&hasta= — margen por producto.
  app.get('/api/reportes/margen', { preHandler: requiereRol('admin') }, async (req) => {
    const rango = rangoSchema.parse(req.query);
    return { reporte: reporteMargen(rango) satisfies ReporteMargen };
  });

  // GET /api/reportes/ventas?desde=&hasta= — ventas por día y por hora.
  app.get('/api/reportes/ventas', { preHandler: requiereRol('admin') }, async (req) => {
    const rango = rangoSchema.parse(req.query);
    return { reporte: reporteVentas(rango) satisfies ReporteVentas };
  });
}
