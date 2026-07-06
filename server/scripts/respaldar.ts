// Respaldo automático, pensado para cron (3:00 am hora del negocio).
// Genera /var/respaldos/pos/pos-YYYY-MM-DD.tar.gz (base + imágenes) y conserva
// los últimos 14. La carpeta destino se puede cambiar con RUTA_RESPALDOS.
//
// Uso:  npm run respaldar        (o directamente: tsx scripts/respaldar.ts)
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { crearRespaldo, nombreRespaldo } from '../src/lib/respaldo.js';

const DIR = process.env.RUTA_RESPALDOS ?? '/var/respaldos/pos';
const CONSERVAR = 14;

const destino = join(DIR, nombreRespaldo());
crearRespaldo(destino);
console.log(`Respaldo creado: ${destino}`);

// Retención: conserva los últimos N respaldos por fecha en el nombre.
const respaldos = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isFile() && /^pos-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(d.name))
  .map((d) => d.name)
  .sort(); // nombre con fecha ISO => orden cronológico
const sobran = respaldos.slice(0, Math.max(0, respaldos.length - CONSERVAR));
for (const nombre of sobran) {
  rmSync(join(DIR, nombre), { force: true });
  console.log(`Respaldo antiguo eliminado: ${nombre}`);
}
