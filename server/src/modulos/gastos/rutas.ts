// Rutas de gastos. Solo admin: los gastos afectan la caja.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requiereRol } from '../auth/middleware.js';
import { crearGasto, listarGastosDelDia } from './servicio.js';

const crearGastoSchema = z.object({
  concepto: z.string().trim().min(1, 'Escribe un concepto.').max(80),
  categoria: z.enum(['insumos', 'servicios', 'nomina', 'otros']),
  monto: z.number().int().positive('El monto debe ser mayor a cero.'),
  metodo: z.enum(['efectivo', 'qr_breb']),
  nota: z.string().trim().max(200).optional()
});

export async function rutasGastos(app: FastifyInstance): Promise<void> {
  // GET /api/gastos — gastos de hoy (día de Bogotá).
  app.get('/api/gastos', { preHandler: requiereRol('admin') }, async () => {
    return { gastos: listarGastosDelDia() };
  });

  // POST /api/gastos — registrar un gasto.
  app.post('/api/gastos', { preHandler: requiereRol('admin') }, async (req, reply) => {
    const datos = crearGastoSchema.parse(req.body);
    const gasto = crearGasto(datos, req.user.id);
    return reply.status(201).send({ gasto });
  });
}
