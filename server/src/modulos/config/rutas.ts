// Rutas de configuración del negocio (ajustes del admin). Solo admin.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ConfigNegocio } from '@pos/shared';
import { requiereRol } from '../auth/middleware.js';
import { guardarWhatsappCierre, obtenerConfig } from './servicio.js';

// El número llega como texto libre (indicativo + dígitos, quizá con espacios o
// signos); se normaliza a solo dígitos. Vacío ⇒ se borra (null).
const cuerpo = z.object({
  whatsapp_cierre: z
    .string()
    .nullable()
    .transform((v) => (v ?? '').replace(/\D/g, ''))
    .superRefine((s, ctx) => {
      if (s !== '' && (s.length < 10 || s.length > 15)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Escribe el número con indicativo (entre 10 y 15 dígitos). Ej: 573001234567.'
        });
      }
    })
    .transform((s) => (s === '' ? null : s))
});

export async function rutasConfig(app: FastifyInstance): Promise<void> {
  app.get('/api/config', { preHandler: requiereRol('admin') }, async () => {
    return obtenerConfig() satisfies ConfigNegocio;
  });

  app.put('/api/config', { preHandler: requiereRol('admin') }, async (req) => {
    const { whatsapp_cierre } = cuerpo.parse(req.body);
    return guardarWhatsappCierre(whatsapp_cierre) satisfies ConfigNegocio;
  });
}
