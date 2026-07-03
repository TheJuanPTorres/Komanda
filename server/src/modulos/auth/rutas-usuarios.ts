// Ruta pública que alimenta la pantalla de acceso: la lista de meseros
// activos para que cada quien seleccione su nombre. No expone datos sensibles
// (nunca pin_hash) y no requiere sesión, por eso vive fuera de las protegidas.
import type { FastifyInstance } from 'fastify';
import { listarMeserosActivos } from './servicio.js';

export async function rutasUsuarios(app: FastifyInstance): Promise<void> {
  // GET /api/usuarios/meseros — lista de meseros activos (público).
  app.get('/api/usuarios/meseros', async () => {
    return { meseros: listarMeserosActivos() };
  });
}
