// Ruta pública que alimenta la pantalla de acceso: la lista de auxiliares
// activos para que cada quien seleccione su nombre. No expone datos sensibles
// (nunca pin_hash) y no requiere sesión, por eso vive fuera de las protegidas.
import type { FastifyInstance } from 'fastify';
import { listarAuxiliaresActivos } from './servicio.js';

export async function rutasUsuarios(app: FastifyInstance): Promise<void> {
  // GET /api/usuarios/auxiliares — lista de auxiliares activos (público).
  app.get('/api/usuarios/auxiliares', async () => {
    return { auxiliares: listarAuxiliaresActivos() };
  });
}
