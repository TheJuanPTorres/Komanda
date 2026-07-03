// Gastos (salidas de dinero). La fecha se guarda como el día de Bogotá para
// que el cierre agrupe por día del negocio (no por el día UTC).
import { db } from '../../db/conexion.js';
import type { CategoriaGasto, Gasto, MetodoPago } from '@pos/shared';
import { fechaBogotaHoy } from '../../lib/fechas.js';

interface FilaGasto {
  id: number;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  metodo: MetodoPago;
  nota: string;
  registrado_por: number;
  fecha: string;
  creado_en: string;
}

const aGasto = (f: FilaGasto): Gasto => ({ ...f });

export interface NuevoGasto {
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  metodo: MetodoPago;
  nota?: string;
}

/** Lista los gastos de un día (por defecto, hoy en Bogotá), más recientes primero. */
export function listarGastosDelDia(fecha: string = fechaBogotaHoy()): Gasto[] {
  const filas = db
    .prepare('SELECT * FROM gastos WHERE fecha = ? ORDER BY creado_en DESC')
    .all(fecha) as FilaGasto[];
  return filas.map(aGasto);
}

/** Registra un gasto con la fecha del día de Bogotá. */
export function crearGasto(datos: NuevoGasto, usuarioId: number): Gasto {
  const fecha = fechaBogotaHoy();
  const info = db
    .prepare(
      `INSERT INTO gastos (concepto, categoria, monto, metodo, nota, registrado_por, fecha)
       VALUES (@concepto, @categoria, @monto, @metodo, @nota, @registrado_por, @fecha)`
    )
    .run({
      concepto: datos.concepto,
      categoria: datos.categoria,
      monto: datos.monto,
      metodo: datos.metodo,
      nota: datos.nota ?? '',
      registrado_por: usuarioId,
      fecha
    });
  const fila = db
    .prepare('SELECT * FROM gastos WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as FilaGasto;
  return aGasto(fila);
}
