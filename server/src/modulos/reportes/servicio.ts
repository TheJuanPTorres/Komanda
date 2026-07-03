// Reportes. Solo cuentan pedidos COBRADOS. El margen usa los snapshots de
// precio/costo guardados en pedido_items (no el precio actual del producto),
// por eso el reporte refleja la realidad del momento de cada venta.
//
// Agrupación por día/hora de Bogotá: se aplica el desfase '-5 hours' (Colombia
// es UTC-5 fijo) sobre las fechas UTC de la DB dentro de SQLite.
import { db } from '../../db/conexion.js';
import type {
  MargenProducto,
  NotificacionPago,
  PagoSinConciliar,
  RangoFechas,
  ReporteConciliacion,
  ReporteMargen,
  ReporteVentas,
  VentasPorDia,
  VentasPorHora
} from '@pos/shared';
import { rangoUtcDesdeFechas } from '../../lib/fechas.js';

function pct(margen: number, ingresos: number): number {
  return ingresos > 0 ? Math.round((margen / ingresos) * 1000) / 10 : 0;
}

// ── Margen por producto ────────────────────────────────────────────────────

export function reporteMargen(rango: RangoFechas): ReporteMargen {
  const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas(rango.desde, rango.hasta);

  const filas = db
    .prepare(
      `SELECT pi.producto_id                        AS producto_id,
              pi.nombre_producto                    AS nombre,
              SUM(pi.cantidad)                       AS unidades,
              SUM(pi.precio_unitario * pi.cantidad)  AS ingresos,
              SUM(pi.costo_unitario  * pi.cantidad)  AS costo
         FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado = 'cobrado'
          AND p.cerrado_en >= ? AND p.cerrado_en < ?
        GROUP BY pi.producto_id
        ORDER BY (SUM(pi.precio_unitario * pi.cantidad) - SUM(pi.costo_unitario * pi.cantidad)) DESC`
    )
    .all(desdeUtc, hastaUtc) as Array<{
    producto_id: number;
    nombre: string;
    unidades: number;
    ingresos: number;
    costo: number;
  }>;

  const productos: MargenProducto[] = filas.map((f) => {
    const margen = f.ingresos - f.costo;
    return { ...f, margen, margen_pct: pct(margen, f.ingresos) };
  });

  const tIngresos = productos.reduce((a, p) => a + p.ingresos, 0);
  const tCosto = productos.reduce((a, p) => a + p.costo, 0);
  const tMargen = tIngresos - tCosto;

  return {
    rango,
    productos,
    totales: {
      unidades: productos.reduce((a, p) => a + p.unidades, 0),
      ingresos: tIngresos,
      costo: tCosto,
      margen: tMargen,
      margen_pct: pct(tMargen, tIngresos)
    }
  };
}

// ── Ventas por día / hora ──────────────────────────────────────────────────

export function reporteVentas(rango: RangoFechas): ReporteVentas {
  const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas(rango.desde, rango.hasta);

  // Dinero por día (de los pagos), con desglose por método.
  const dineroDia = db
    .prepare(
      `SELECT date(creado_en, '-5 hours') AS fecha,
              COALESCE(SUM(CASE WHEN metodo = 'efectivo' THEN monto END), 0) AS efectivo,
              COALESCE(SUM(CASE WHEN metodo = 'qr_breb'  THEN monto END), 0) AS qr,
              COALESCE(SUM(monto), 0)                                        AS total
         FROM pagos
        WHERE creado_en >= ? AND creado_en < ?
        GROUP BY fecha`
    )
    .all(desdeUtc, hastaUtc) as Array<{ fecha: string; efectivo: number; qr: number; total: number }>;

  // # de pedidos cobrados por día.
  const pedidosDia = db
    .prepare(
      `SELECT date(cerrado_en, '-5 hours') AS fecha, COUNT(*) AS n
         FROM pedidos
        WHERE estado = 'cobrado' AND cerrado_en >= ? AND cerrado_en < ?
        GROUP BY fecha`
    )
    .all(desdeUtc, hastaUtc) as Array<{ fecha: string; n: number }>;

  const nPorFecha = new Map(pedidosDia.map((r) => [r.fecha, r.n]));
  const por_dia: VentasPorDia[] = dineroDia
    .map((d) => ({ ...d, num_pedidos: nPorFecha.get(d.fecha) ?? 0 }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Dinero y pedidos por hora del día (0–23), agregados sobre todo el rango.
  const dineroHora = db
    .prepare(
      `SELECT CAST(strftime('%H', creado_en, '-5 hours') AS INTEGER) AS hora,
              COALESCE(SUM(monto), 0) AS total
         FROM pagos
        WHERE creado_en >= ? AND creado_en < ?
        GROUP BY hora`
    )
    .all(desdeUtc, hastaUtc) as Array<{ hora: number; total: number }>;

  const pedidosHora = db
    .prepare(
      `SELECT CAST(strftime('%H', cerrado_en, '-5 hours') AS INTEGER) AS hora, COUNT(*) AS n
         FROM pedidos
        WHERE estado = 'cobrado' AND cerrado_en >= ? AND cerrado_en < ?
        GROUP BY hora`
    )
    .all(desdeUtc, hastaUtc) as Array<{ hora: number; n: number }>;

  const totalPorHora = new Map(dineroHora.map((r) => [r.hora, r.total]));
  const nPorHora = new Map(pedidosHora.map((r) => [r.hora, r.n]));
  const por_hora: VentasPorHora[] = Array.from({ length: 24 }, (_, hora) => ({
    hora,
    total: totalPorHora.get(hora) ?? 0,
    num_pedidos: nPorHora.get(hora) ?? 0
  }));

  const efectivo = por_dia.reduce((a, d) => a + d.efectivo, 0);
  const qr = por_dia.reduce((a, d) => a + d.qr, 0);
  const total = efectivo + qr;
  const num_pedidos = por_dia.reduce((a, d) => a + d.num_pedidos, 0);

  return {
    rango,
    por_dia,
    por_hora,
    totales: {
      efectivo,
      qr,
      total,
      num_pedidos,
      ticket_promedio: num_pedidos > 0 ? Math.round(total / num_pedidos) : 0
    }
  };
}

// ── Conciliación de pagos QR (Fase 7) ──────────────────────────────────────
// El servidor solo LEE lo que el lector (proceso aparte) escribió en
// notificaciones_pago. Muestra los descuadres para revisión.

export function reporteConciliacion(rango: RangoFechas): ReporteConciliacion {
  const { desdeUtc, hastaUtc } = rangoUtcDesdeFechas(rango.desde, rango.hasta);

  const pagosQr = db
    .prepare(
      "SELECT COUNT(*) AS n FROM pagos WHERE metodo = 'qr_breb' AND creado_en >= ? AND creado_en < ?"
    )
    .get(desdeUtc, hastaUtc) as { n: number };

  const conciliados = db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM pagos p
        WHERE p.metodo = 'qr_breb' AND p.creado_en >= ? AND p.creado_en < ?
          AND EXISTS (SELECT 1 FROM notificaciones_pago n WHERE n.pago_id = p.id)`
    )
    .get(desdeUtc, hastaUtc) as { n: number };

  // Pagos QR sin un correo del banco que los respalde.
  const pagos_sin_conciliar = db
    .prepare(
      `SELECT p.id AS pago_id, p.pedido_id AS pedido_id, p.monto AS monto,
              p.referencia_externa AS referencia_externa, p.creado_en AS creado_en
         FROM pagos p
        WHERE p.metodo = 'qr_breb' AND p.creado_en >= ? AND p.creado_en < ?
          AND NOT EXISTS (SELECT 1 FROM notificaciones_pago n WHERE n.pago_id = p.id)
        ORDER BY p.creado_en DESC`
    )
    .all(desdeUtc, hastaUtc) as PagoSinConciliar[];

  // Correos del banco que no cruzaron con ningún pago registrado.
  const sin_pago = db
    .prepare(
      `SELECT id, mensaje_id, asunto, remitente, monto, referencia, fecha_correo,
              pago_id, estado, creado_en
         FROM notificaciones_pago
        WHERE estado = 'sin_pago' AND creado_en >= ? AND creado_en < ?
        ORDER BY creado_en DESC`
    )
    .all(desdeUtc, hastaUtc) as NotificacionPago[];

  return {
    rango,
    resumen: {
      pagos_qr: pagosQr.n,
      conciliados: conciliados.n,
      pagos_sin_correo: pagosQr.n - conciliados.n,
      correos_sin_pago: sin_pago.length
    },
    sin_pago,
    pagos_sin_conciliar
  };
}
