// Rutas de administración de infraestructura (solo admin).
// Descarga de respaldo bajo demanda: genera un .tar.gz del momento (base +
// imágenes) y lo envía como descarga. Rate-limited (operación costosa).
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requiereRol } from '../auth/middleware.js';
import { crearRespaldo, nombreRespaldo } from '../../lib/respaldo.js';

export async function rutasAdmin(app: FastifyInstance): Promise<void> {
  // GET /api/admin/respaldo — genera y descarga el respaldo del momento.
  app.get(
    '/api/admin/respaldo',
    {
      preHandler: requiereRol('admin'),
      config: { rateLimit: { max: 6, timeWindow: '1 hour' } }
    },
    async (_req, reply) => {
      const tmp = mkdtempSync(join(tmpdir(), 'pos-descarga-'));
      const nombre = nombreRespaldo();
      const ruta = join(tmp, nombre);
      crearRespaldo(ruta);

      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Disposition', `attachment; filename="${nombre}"`);
      const stream = createReadStream(ruta);
      // Limpia el temporal cuando termine de enviarse (bien o mal).
      stream.on('close', () => void rm(tmp, { recursive: true, force: true }));
      return reply.send(stream);
    }
  );
}
