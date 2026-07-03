// Rutas de cobro. REGLA SAGRADA DEL NEGOCIO: solo el rol admin puede cobrar y
// cerrar pedidos. La barrera es requiereRol('admin') aquí, en el servidor.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CobroResp } from '@pos/shared';
import { requiereRol } from '../auth/middleware.js';
import { emisor } from '../../ws/emisor.js';
import { registrarCobro } from './servicio.js';

const cobroSchema = z.object({
  pedidoId: z.number().int().positive(),
  pagos: z
    .array(
      z.object({
        metodo: z.enum(['efectivo', 'qr_breb']),
        monto: z.number().int().positive('Cada pago debe ser mayor a cero.'),
        referencia_externa: z.string().trim().max(120).optional()
      })
    )
    .min(1, 'Debe haber al menos un pago.')
    .max(2, 'Como máximo un pago por método.')
});

export async function rutasCobros(app: FastifyInstance): Promise<void> {
  // POST /api/cobros — registra el/los pago(s) y cierra el pedido (SOLO admin).
  app.post('/api/cobros', { preHandler: requiereRol('admin') }, async (req) => {
    const { pedidoId, pagos } = cobroSchema.parse(req.body);
    const resultado = registrarCobro(pedidoId, pagos, req.user.id);

    emisor.pedidoCobrado({
      pedidoId: resultado.pedidoId,
      cerrado_en: resultado.cerrado_en,
      cerrado_por: req.user.id
    });

    return resultado satisfies CobroResp;
  });
}
