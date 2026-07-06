// Creación de respaldos consistentes: un solo archivo .tar.gz que contiene
// pos.db (copia consistente vía VACUUM INTO, segura en caliente y en modo WAL)
// e imagenes/ (fotos de producto). Lo usan el script de cron y el endpoint.
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../config.js';

/**
 * Genera un respaldo .tar.gz en `destino`. Copia la base con VACUUM INTO (no
 * copia el archivo a mano: eso perdería el -wal) y añade las imágenes.
 */
export function crearRespaldo(destino: string): void {
  if (!existsSync(config.rutaDb)) {
    throw new Error(`No existe la base en ${config.rutaDb}.`);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'pos-respaldo-'));
  try {
    // 1) Copia consistente de la base (VACUUM INTO escribe un archivo nuevo).
    const db = new Database(config.rutaDb, { readonly: true });
    try {
      db.exec(`VACUUM INTO '${join(tmp, 'pos.db').replace(/\\/g, '/').replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }
    // 2) Imágenes (si hay).
    if (existsSync(config.rutaImagenes)) {
      cpSync(config.rutaImagenes, join(tmp, 'imagenes'), { recursive: true });
    } else {
      mkdirSync(join(tmp, 'imagenes'), { recursive: true });
    }
    // 3) Empaqueta ambos en un solo .tar.gz. --force-local evita que GNU tar
    //    interprete rutas con ':' (Windows: C:\...) como host remoto.
    mkdirSync(join(destino, '..'), { recursive: true });
    execFileSync('tar', ['--force-local', '-czf', destino, '-C', tmp, 'pos.db', 'imagenes']);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Nombre de archivo de respaldo por fecha del negocio: pos-YYYY-MM-DD.tar.gz */
export function nombreRespaldo(fecha = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.tzNegocio,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(fecha);
  return `pos-${dia}.tar.gz`;
}
