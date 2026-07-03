// Conexión única (singleton) a SQLite mediante better-sqlite3.
// better-sqlite3 es SÍNCRONO: no hay await; las transacciones son nativas.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.js';

// Asegura que exista la carpeta data/ antes de abrir el archivo.
mkdirSync(dirname(config.rutaDb), { recursive: true });

export const db: Database.Database = new Database(config.rutaDb);

// WAL: mejor concurrencia lectura/escritura (varios meseros a la vez).
db.pragma('journal_mode = WAL');
// Las claves foráneas NO están activas por defecto en SQLite: encenderlas.
db.pragma('foreign_keys = ON');
// Espera hasta 5s si la DB está bloqueada por otra escritura, en vez de fallar.
db.pragma('busy_timeout = 5000');

// Cierre ordenado al terminar el proceso.
function cerrar(): void {
  try {
    db.close();
  } catch {
    // Ignorar: el proceso ya está terminando.
  }
}
process.on('exit', cerrar);
process.on('SIGINT', () => {
  cerrar();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cerrar();
  process.exit(0);
});
