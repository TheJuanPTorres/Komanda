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
