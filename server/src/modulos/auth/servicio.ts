// Acceso a datos de usuarios para autenticación.
// Nota: pin_hash se consulta solo internamente; nunca se expone al cliente.
import { db } from '../../db/conexion.js';
import type { Rol, Usuario } from '@pos/shared';
import { hashearPin } from '../../lib/pin.js';

interface FilaUsuario {
  id: number;
  nombre: string;
  rol: Rol;
  pin_hash: string | null;
  activo: number;
  debe_cambiar_pin: number;
  creado_en: string;
}

// ── Bloqueo por cuenta (persistido en DB, independiente de la IP) ──────────
const MAX_FALLOS = 8; // fallos acumulados que bloquean la cuenta
const VENTANA_MIN = 15; // ventana de tiempo del conteo

/** Registra un intento fallido de login para una cuenta. */
export function registrarIntentoFallido(usuarioId: number): void {
  db.prepare('INSERT INTO intentos_login (usuario_id) VALUES (?)').run(usuarioId);
}

/** ¿La cuenta está bloqueada por acumular demasiados fallos recientes? */
export function cuentaBloqueada(usuarioId: number): boolean {
  const fila = db
    .prepare(
      `SELECT COUNT(*) AS n FROM intentos_login
        WHERE usuario_id = ? AND creado_en > datetime('now', ?)`
    )
    .get(usuarioId, `-${VENTANA_MIN} minutes`) as { n: number };
  return fila.n >= MAX_FALLOS;
}

/** Limpia los fallos de una cuenta (tras un login exitoso). */
export function limpiarIntentos(usuarioId: number): void {
  db.prepare('DELETE FROM intentos_login WHERE usuario_id = ?').run(usuarioId);
}

/** Cambia el PIN del usuario (ya hasheado) y baja la bandera de cambio forzado. */
export function cambiarPinUsuario(usuarioId: number, pinNuevo: string): void {
  db.prepare('UPDATE usuarios SET pin_hash = ?, debe_cambiar_pin = 0 WHERE id = ?').run(
    hashearPin(pinNuevo),
    usuarioId
  );
}

// Convierte la fila cruda de SQLite (activo como 0/1) al tipo público Usuario.
// Nunca expone el hash; solo si el usuario TIENE PIN (para la UI de acceso/equipo).
function aUsuario(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rol: fila.rol,
    activo: fila.activo === 1,
    tiene_pin: Boolean(fila.pin_hash),
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
 * Crea un auxiliar con su PIN (4 dígitos, obligatorio en internet público). Si
 * el nombre ya existe: si era un auxiliar desactivado, lo reactiva y le fija el
 * nuevo PIN; si está en uso (activo, o es admin), es conflicto. Devuelve el
 * auxiliar o null si el nombre está en conflicto.
 */
export function crearAuxiliar(nombre: string, pin: string): Usuario | null {
  const hash = hashearPin(pin);
  const existente = buscarPorNombre(nombre);
  if (existente) {
    if (existente.rol === 'auxiliar' && existente.activo === 0) {
      db.prepare('UPDATE usuarios SET activo = 1, pin_hash = ? WHERE id = ?').run(hash, existente.id);
      return aUsuario(buscarPorId(existente.id)!);
    }
    return null; // nombre en uso (auxiliar activo o admin)
  }
  const info = db
    .prepare("INSERT INTO usuarios (nombre, rol, pin_hash) VALUES (?, 'auxiliar', ?)")
    .run(nombre, hash);
  return aUsuario(buscarPorId(Number(info.lastInsertRowid))!);
}

/** Asigna/restablece el PIN (4 dígitos) de un auxiliar. */
export function asignarPinAuxiliar(id: number, pin: string): void {
  db.prepare("UPDATE usuarios SET pin_hash = ? WHERE id = ? AND rol = 'auxiliar'").run(
    hashearPin(pin),
    id
  );
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
