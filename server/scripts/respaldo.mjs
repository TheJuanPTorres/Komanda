// Respaldo de la base de datos. Usa la API de backup de SQLite (better-sqlite3),
// que produce una copia CONSISTENTE aunque la DB esté en uso y en modo WAL
// (no basta con copiar el .db a mano: se perdería el -wal).
//
// Uso: npm run respaldo            (desde la raíz o desde server/)
// Deja las copias en server/data/respaldos/ y conserva las últimas 14.
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_DB = process.env.POS_DB ?? resolve(aqui, '..', 'data', 'pos.db');
const DIR_RESPALDOS = resolve(aqui, '..', 'data', 'respaldos');
const CONSERVAR = 14;

if (!existsSync(RUTA_DB)) {
  console.error(`No existe la base de datos en ${RUTA_DB}. ¿Ya corriste el seed?`);
  process.exit(1);
}

mkdirSync(DIR_RESPALDOS, { recursive: true });

// Marca de tiempo apta para nombre de archivo: 2026-07-02-23-30-05
const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const destino = join(DIR_RESPALDOS, `pos-${sello}.db`);

const db = new Database(RUTA_DB, { readonly: true });
try {
  await db.backup(destino);
  console.log(`Respaldo creado: ${destino}`);
} finally {
  db.close();
}

// Conserva solo las últimas N copias; borra las más viejas.
const copias = readdirSync(DIR_RESPALDOS)
  .filter((f) => /^pos-.*\.db$/.test(f))
  .sort(); // nombre con fecha ISO => orden cronológico
const sobran = copias.slice(0, Math.max(0, copias.length - CONSERVAR));
for (const f of sobran) {
  rmSync(join(DIR_RESPALDOS, f));
  console.log(`Copia antigua eliminada: ${f}`);
}
