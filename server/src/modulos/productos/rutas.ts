// Rutas del menú (lectura). Requiere sesión: solo personal autenticado
// puede ver el menú para tomar pedidos.
import type { FastifyInstance } from 'fastify';
import type { MenuAgrupado } from '@pos/shared';
import { requiereSesion } from '../auth/middleware.js';
import { obtenerMenu } from './servicio.js';

export async function rutasProductos(app: FastifyInstance): Promise<void> {
  // GET /api/menu — categorías activas con sus productos activos.
  app.get('/api/menu', { preHandler: requiereSesion }, async () => {
    return { menu: obtenerMenu() satisfies MenuAgrupado };
  });
}
