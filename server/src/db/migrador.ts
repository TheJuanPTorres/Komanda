// Sistema de migraciones simple: aplica en orden los archivos NNN_nombre.sql
// de la carpeta migraciones/ que aún no estén registrados en _migraciones.
// Cada migración corre dentro de una transacción; si falla, se revierte entera.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './conexion.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const CARPETA_MIGRACIONES = join(aqui, 'migraciones');

// Solo aceptamos archivos con el patrón NNN_algo.sql (p. ej. 001_inicial.sql).
const PATRON = /^\d{3}_.+\.sql$/;

function asegurarTablaRegistro(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre     TEXT NOT NULL PRIMARY KEY,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migracionesPendientes(): string[] {
  const aplicadas = new Set(
    db
      .prepare('SELECT nombre FROM _migraciones')
      .all()
      .map((fila) => (fila as { nombre: string }).nombre)
  );

  return readdirSync(CARPETA_MIGRACIONES)
    .filter((archivo) => PATRON.test(archivo))
    .sort() // orden lexicográfico = orden numérico gracias al prefijo NNN
    .filter((archivo) => !aplicadas.has(archivo));
}

/**
 * Aplica todas las migraciones pendientes. Idempotente: si no hay pendientes,
 * no hace nada. Devuelve la lista de migraciones que se aplicaron.
 */
export function migrar(): string[] {
  asegurarTablaRegistro();
  const pendientes = migracionesPendientes();

  // Las claves foráneas se apagan durante las migraciones para permitir
  // reconstruir tablas referenciadas (patrón oficial de SQLite: crear nueva,
  // copiar, DROP, RENAME). Debe hacerse FUERA de una transacción. Se restauran
  // al terminar. Cada migración corre igual dentro de su propia transacción.
  db.pragma('foreign_keys = OFF');
  try {
    for (const archivo of pendientes) {
      const sql = readFileSync(join(CARPETA_MIGRACIONES, archivo), 'utf8');
      const aplicar = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO _migraciones (nombre) VALUES (?)').run(archivo);
      });
      aplicar();
      console.log(`Migración aplicada: ${archivo}`);
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }

  if (pendientes.length === 0) {
    console.log('Base de datos al día: no hay migraciones pendientes.');
  }

  return pendientes;
}
