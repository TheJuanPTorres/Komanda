// Respaldo del sistema: la base de datos + las imágenes de producto.
// La DB se copia con la API de backup de SQLite (better-sqlite3), que produce
// una copia CONSISTENTE aunque esté en uso y en modo WAL (no basta con copiar
// el .db a mano: se perdería el -wal). Las imágenes se copian tal cual.
//
// Uso: npm run respaldo            (desde la raíz o desde server/)
// Cada respaldo es una carpeta server/data/respaldos/{fecha}/ con pos.db e
// imagenes/. Se conservan los últimos 14.
import Database from 'better-sqlite3';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const DIR_DATOS = process.env.POS_DB ? dirname(process.env.POS_DB) : resolve(aqui, '..', 'data');
const RUTA_DB = process.env.POS_DB ?? join(DIR_DATOS, 'pos.db');
const DIR_IMAGENES = join(DIR_DATOS, 'imagenes');
const DIR_RESPALDOS = join(DIR_DATOS, 'respaldos');
const CONSERVAR = 14;

if (!existsSync(RUTA_DB)) {
  console.error(`No existe la base de datos en ${RUTA_DB}. ¿Ya corriste el seed?`);
  process.exit(1);
}

// Carpeta de este respaldo: server/data/respaldos/2026-07-03-21-30-05/
const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const carpeta = join(DIR_RESPALDOS, sello);
mkdirSync(carpeta, { recursive: true });

// 1) Base de datos (copia consistente).
const db = new Database(RUTA_DB, { readonly: true });
try {
  await db.backup(join(carpeta, 'pos.db'));
  console.log(`Base respaldada: ${join(carpeta, 'pos.db')}`);
} finally {
  db.close();
}

// 2) Imágenes de producto (si hay).
if (existsSync(DIR_IMAGENES)) {
  cpSync(DIR_IMAGENES, join(carpeta, 'imagenes'), { recursive: true });
  console.log('Imágenes respaldadas.');
}

// Conserva solo los últimos N respaldos; borra los más viejos.
const respaldos = readdirSync(DIR_RESPALDOS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(d.name))
  .map((d) => d.name)
  .sort(); // nombre con fecha ISO => orden cronológico
const sobran = respaldos.slice(0, Math.max(0, respaldos.length - CONSERVAR));
for (const nombre of sobran) {
  rmSync(join(DIR_RESPALDOS, nombre), { recursive: true, force: true });
  console.log(`Respaldo antiguo eliminado: ${nombre}`);
}

console.log(`Respaldo completo en ${carpeta}`);
