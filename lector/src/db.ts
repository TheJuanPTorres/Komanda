// Conexión a la MISMA base SQLite del servidor. SQLite en modo WAL admite
// varios procesos (el servidor y el lector) leyendo/escribiendo a la vez;
// busy_timeout evita fallar si hay un bloqueo momentáneo.
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { config } from './config.js';

if (!existsSync(config.rutaDb)) {
  throw new Error(
    `No existe la base de datos en ${config.rutaDb}. Arranca el servidor primero (aplica las migraciones).`
  );
}

export const db: Database.Database = new Database(config.rutaDb);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
