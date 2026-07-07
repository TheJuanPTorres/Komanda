// Explorador de ventas (v1.5-B, Parte 2). Solo lectura, solo admin. Lista los
// pedidos COBRADOS y CANCELADOS con filtros combinables y paginación por cursor
// (fecha de cierre). Los agregados (# ventas, total, ticket) cuentan SOLO lo
// cobrado del filtro. La ficha reconstruye la venta con sus items (snapshots),
// pagos y la línea de tiempo completa de la bitácora.
import { db } from '../../db/conexion.js';
import type {
  AgregadosVentas,
  FiltroVentas,
  MetodoPago,
  Pago,
  PulsoDia,
  RespVentas,
  VentaDetalle,
  VentaItemDetalle,
  VentaResumen
} from '@pos/shared';
import { config } from '../../config.js';
import { errores } from '../../lib/errores.js';
import { rangoDiaOperativo, rangoUtcDesdeFechas } from '../../lib/fechas.js';
import { listarEventos } from '../pedidos/eventos.js';

const PAGINA = 50;

// Tipos de evento que marcan que una venta tuvo correcciones.
const TIPOS_CORRECCION = "('item_reducido','item_eliminado','correccion_solicitada','correccion_rechazada')";


interface FilaVenta {
  id: number;
  tipo: 'mesa' | 'barra';
  mesa_numero: number | null;
  turno: number | null;
  cliente_nombre: string | null;
  estado: 'cobrado' | 'cancelado';
  creado_en: string;
  cerrado_en: string | null;
  total: number;
  metodos_raw: string | null;
  auxiliar_nombre: string;
  con_correcciones: number;
}

// Arma las condiciones WHERE y los parámetros a partir del filtro (sin cursor).
function condiciones(f: FiltroVentas): { sql: string[]; params: Record<string, unknown> } {
  const sql: string[] = [];
  const params: Record<string, unknown> = {};

  // Estado: por defecto cobrado + cancelado; si viene, se restringe. Siempre
  // parametrizado para que `params` nunca quede vacío (better-sqlite3 lo exige).
  if (f.estado) {
    sql.push('p.estado = @estado');
    params.estado = f.estado;
  } else {
    sql.push('p.estado IN (@estadoA, @estadoB)');
    params.estadoA = 'cobrado';
    params.estadoB = 'cancelado';
  }

  if (f.desde && f.hasta) {
    const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas(f.desde, f.hasta);
    sql.push('p.cerrado_en >= @desdeUtc AND p.cerrado_en < @hastaUtc');
    params.desdeUtc = desdeUtc;
    params.hastaUtc = hastaUtc;
  }
  if (f.auxiliar_id) {
    sql.push('p.auxiliar_id = @auxiliarId');
    params.auxiliarId = f.auxiliar_id;
  }
  if (f.tipo) {
    sql.push('p.tipo = @tipo');
    params.tipo = f.tipo;
  }
  if (f.producto_id) {
    sql.push('EXISTS (SELECT 1 FROM pedido_items pi WHERE pi.pedido_id = p.id AND pi.producto_id = @productoId)');
    params.productoId = f.producto_id;
  }
  if (f.metodo) {
    sql.push('EXISTS (SELECT 1 FROM pagos pg WHERE pg.pedido_id = p.id AND pg.metodo = @metodo)');
    params.metodo = f.metodo;
  }
  if (f.con_correcciones) {
    sql.push(
      `EXISTS (SELECT 1 FROM pedido_eventos e WHERE e.pedido_id = p.id AND e.tipo IN ${TIPOS_CORRECCION})`
    );
  }
  return { sql, params };
}

function aResumen(r: FilaVenta): VentaResumen {
  const metodos = r.metodos_raw
    ? (r.metodos_raw.split(',').filter(Boolean) as MetodoPago[])
    : [];
  return {
    id: r.id,
    tipo: r.tipo,
    mesa_numero: r.mesa_numero,
    turno: r.turno,
    cliente_nombre: r.cliente_nombre,
    estado: r.estado,
    creado_en: r.creado_en,
    cerrado_en: r.cerrado_en,
    total: r.total,
    metodos,
    auxiliar_nombre: r.auxiliar_nombre,
    con_correcciones: r.con_correcciones === 1
  };
}

export function listarVentas(f: FiltroVentas): RespVentas {
  const { sql, params } = condiciones(f);

  // Cursor: (cerrado_en, id) estrictamente anteriores (orden DESC, DESC).
  const conds = [...sql];
  if (f.cursor) {
    const [cc, cid] = f.cursor.split('|');
    conds.push('(p.cerrado_en < @curFecha OR (p.cerrado_en = @curFecha AND p.id < @curId))');
    params.curFecha = cc;
    params.curId = Number(cid);
  }
  const where = conds.join(' AND ');

  const stmtLista = db.prepare(
    `SELECT p.id, p.tipo, p.mesa_numero, p.turno, p.cliente_nombre, p.estado,
            p.creado_en, p.cerrado_en,
            u.nombre AS auxiliar_nombre,
            COALESCE((SELECT SUM(monto) FROM pagos WHERE pedido_id = p.id), 0) AS total,
            (SELECT GROUP_CONCAT(DISTINCT metodo) FROM pagos WHERE pedido_id = p.id) AS metodos_raw,
            EXISTS (SELECT 1 FROM pedido_eventos e WHERE e.pedido_id = p.id AND e.tipo IN ${TIPOS_CORRECCION}) AS con_correcciones
       FROM pedidos p
       JOIN usuarios u ON u.id = p.auxiliar_id
      WHERE ${where}
      ORDER BY p.cerrado_en DESC, p.id DESC
      LIMIT ${PAGINA + 1}`
  );
  const filasVenta = stmtLista.all(params) as FilaVenta[];

  // Se pidió una fila extra para saber si hay página siguiente.
  const hayMas = filasVenta.length > PAGINA;
  const pagina = hayMas ? filasVenta.slice(0, PAGINA) : filasVenta;
  const ventas = pagina.map(aResumen);
  const ultimo = pagina[pagina.length - 1];
  const cursor = hayMas && ultimo ? `${ultimo.cerrado_en}|${ultimo.id}` : null;

  // Agregados: SOLO cobrados del filtro completo (sin cursor ni límite). Se usan
  // solo los params de filtro (no los del cursor), por eso se recalculan.
  const { params: pFiltro } = condiciones(f);
  const stmtAgg = db.prepare(
    `SELECT COUNT(*) AS numero,
            COALESCE(SUM((SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE pedido_id = p.id)), 0) AS total
       FROM pedidos p
      WHERE ${sql.join(' AND ')} AND p.estado = 'cobrado'`
  );
  const agg = stmtAgg.get(pFiltro) as { numero: number; total: number };

  const agregados: AgregadosVentas = {
    numero: agg.numero,
    total: agg.total,
    ticket_promedio: agg.numero > 0 ? Math.round(agg.total / agg.numero) : 0
  };

  return { ventas, agregados, cursor };
}

export function detalleVenta(id: number): VentaDetalle {
  const fila = db
    .prepare(
      `SELECT p.id, p.tipo, p.mesa_numero, p.turno, p.cliente_nombre, p.estado,
              p.creado_en, p.cerrado_en,
              u.nombre AS auxiliar_nombre,
              COALESCE((SELECT SUM(monto) FROM pagos WHERE pedido_id = p.id), 0) AS total,
              (SELECT GROUP_CONCAT(DISTINCT metodo) FROM pagos WHERE pedido_id = p.id) AS metodos_raw,
              EXISTS (SELECT 1 FROM pedido_eventos e WHERE e.pedido_id = p.id AND e.tipo IN ${TIPOS_CORRECCION}) AS con_correcciones
         FROM pedidos p
         JOIN usuarios u ON u.id = p.auxiliar_id
        WHERE p.id = ? AND p.estado IN ('cobrado', 'cancelado')`
    )
    .get(id) as FilaVenta | undefined;
  if (!fila) throw errores.noEncontrado('Esa venta no existe.');

  const items = db
    .prepare(
      `SELECT producto_id, nombre_producto AS nombre, cantidad,
              precio_unitario, costo_unitario,
              precio_unitario * cantidad AS subtotal
         FROM pedido_items WHERE pedido_id = ? ORDER BY id`
    )
    .all(id) as VentaItemDetalle[];

  const pagos = db
    .prepare(
      `SELECT id, pedido_id, metodo, monto, referencia_externa, verificado,
              registrado_por, creado_en
         FROM pagos WHERE pedido_id = ? ORDER BY id`
    )
    .all(id) as Pago[];

  return { venta: aResumen(fila), items, pagos, eventos: listarEventos(id) };
}

// ── Pulso del día (franja en vivo del panel admin) ─────────────────────────
export function pulsoDelDia(): PulsoDia {
  const { desdeUtc, hastaUtc } = rangoDiaOperativo();
  const ventas = db
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM((SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE pedido_id = p.id)), 0) AS t
         FROM pedidos p
        WHERE p.estado = 'cobrado' AND p.cerrado_en >= ? AND p.cerrado_en < ?`
    )
    .get(desdeUtc, hastaUtc) as { n: number; t: number };
  const abiertos = db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'abierto'").get() as {
    n: number;
  };
  const corr = db
    .prepare("SELECT COUNT(*) AS n FROM solicitudes_correccion WHERE estado = 'pendiente'")
    .get() as { n: number };
  return { ventas_hoy: ventas.t, pedidos_hoy: ventas.n, abiertos: abiertos.n, correcciones: corr.n };
}

// ── Exportación CSV del filtro activo (Excel en español) ───────────────────
const fmtFechaCsv = new Intl.DateTimeFormat('es-CO', {
  timeZone: config.tzNegocio,
  dateStyle: 'short',
  timeStyle: 'short'
});

function refCsv(r: FilaVenta): string {
  return r.tipo === 'mesa'
    ? `Mesa ${r.mesa_numero}`
    : `B-${String(r.turno ?? 0).padStart(2, '0')} · ${r.cliente_nombre ?? ''}`;
}

// Envuelve un valor entre comillas y escapa las internas (formato CSV).
const celda = (v: unknown): string => `"${String(v).replace(/"/g, '""')}"`;

export function exportarVentasCsv(f: FiltroVentas): string {
  const { sql, params } = condiciones(f);
  const stmt = db.prepare(
    `SELECT p.id, p.tipo, p.mesa_numero, p.turno, p.cliente_nombre, p.estado,
            p.creado_en, p.cerrado_en,
            u.nombre AS auxiliar_nombre,
            COALESCE((SELECT SUM(monto) FROM pagos WHERE pedido_id = p.id), 0) AS total,
            (SELECT GROUP_CONCAT(DISTINCT metodo) FROM pagos WHERE pedido_id = p.id) AS metodos_raw,
            0 AS con_correcciones
       FROM pedidos p
       JOIN usuarios u ON u.id = p.auxiliar_id
      WHERE ${sql.join(' AND ')}
      ORDER BY p.cerrado_en DESC, p.id DESC`
  );
  const filas = stmt.all(params) as FilaVenta[];

  const encabezado = ['Fecha', 'Referencia', 'Tipo', 'Estado', 'Auxiliar', 'Métodos', 'Total'];
  const lineas = [encabezado.map(celda).join(',')];
  for (const r of filas) {
    const fecha = r.cerrado_en ? fmtFechaCsv.format(new Date(r.cerrado_en.replace(' ', 'T') + 'Z')) : '';
    const metodos = r.metodos_raw
      ? r.metodos_raw
          .split(',')
          .map((m) => (m === 'qr_breb' ? 'QR Bre-B' : 'Efectivo'))
          .join(' + ')
      : '';
    lineas.push(
      [fecha, refCsv(r), r.tipo, r.estado, r.auxiliar_nombre, metodos, r.total].map(celda).join(',')
    );
  }
  // BOM UTF-8 + CRLF para que Excel en español lo abra bien.
  return '﻿' + lineas.join('\r\n');
}
