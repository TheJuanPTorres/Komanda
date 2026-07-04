// Acceso a datos de usuarios para autenticación.
// Nota: pin_hash se consulta solo internamente; nunca se expone al cliente.
import { db } from '../../db/conexion.js';
import type { Rol, Usuario } from '@pos/shared';

interface FilaUsuario {
  id: number;
  nombre: string;
  rol: Rol;
  pin_hash: string | null;
  activo: number;
  creado_en: string;
}

// Convierte la fila cruda de SQLite (activo como 0/1) al tipo público Usuario.
function aUsuario(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rol: fila.rol,
    activo: fila.activo === 1,
    creado_en: fila.creado_en
  };
}

export function buscarAdmin(): FilaUsuario | undefined {
  return db
    .prepare("SELECT * FROM usuarios WHERE rol = 'admin' AND activo = 1 LIMIT 1")
    .get() as FilaUsuario | undefined;
}

export function buscarPorId(id: number): FilaUsuario | undefined {
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as
    | FilaUsuario
    | undefined;
}

export function listarAuxiliaresActivos(): Usuario[] {
  const filas = db
    .prepare(
      "SELECT * FROM usuarios WHERE rol = 'auxiliar' AND activo = 1 ORDER BY nombre"
    )
    .all() as FilaUsuario[];
  return filas.map(aUsuario);
}

// ── CRUD de auxiliares (admin) ─────────────────────────────────────────────

function buscarPorNombre(nombre: string): FilaUsuario | undefined {
  return db.prepare('SELECT * FROM usuarios WHERE nombre = ?').get(nombre) as
    | FilaUsuario
    | undefined;
}

/** Un auxiliar activo por id (para editar/desactivar). */
export function buscarAuxiliar(id: number): FilaUsuario | undefined {
  return db
    .prepare("SELECT * FROM usuarios WHERE id = ? AND rol = 'auxiliar' AND activo = 1")
    .get(id) as FilaUsuario | undefined;
}

/**
 * Crea un auxiliar (sin PIN). Si el nombre ya existe: si era un auxiliar
 * desactivado, lo reactiva; si está en uso (activo, o es admin), es conflicto.
 * Devuelve el auxiliar o null si el nombre está en conflicto.
 */
export function crearAuxiliar(nombre: string): Usuario | null {
  const existente = buscarPorNombre(nombre);
  if (existente) {
    if (existente.rol === 'auxiliar' && existente.activo === 0) {
      db.prepare('UPDATE usuarios SET activo = 1 WHERE id = ?').run(existente.id);
      return aUsuario(buscarPorId(existente.id)!);
    }
    return null; // nombre en uso (auxiliar activo o admin)
  }
  const info = db
    .prepare("INSERT INTO usuarios (nombre, rol, pin_hash) VALUES (?, 'auxiliar', NULL)")
    .run(nombre);
  return aUsuario(buscarPorId(Number(info.lastInsertRowid))!);
}

/** Renombra un auxiliar. Devuelve el auxiliar, o null si el nombre choca. */
export function renombrarAuxiliar(id: number, nombre: string): Usuario | null {
  const otro = buscarPorNombre(nombre);
  if (otro && otro.id !== id) return null; // nombre usado por otro usuario
  db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(nombre, id);
  return aUsuario(buscarPorId(id)!);
}

/** Desactiva un auxiliar (borrado lógico). */
export function desactivarAuxiliar(id: number): void {
  db.prepare("UPDATE usuarios SET activo = 0 WHERE id = ? AND rol = 'auxiliar'").run(id);
}
