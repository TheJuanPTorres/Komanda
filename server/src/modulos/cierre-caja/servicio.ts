// Cierre de caja del día. Junta las ventas por método (de los pagos), los
// gastos en efectivo y los pedidos cobrados del día para calcular el efectivo
// esperado y contrastarlo con lo contado físicamente.
//
// "El día" = día calendario de Bogotá. Ventas/pedidos se filtran por el rango
// UTC equivalente (creado_en/cerrado_en); gastos y el cierre usan la fecha
// de Bogotá directamente.
import { db } from '../../db/conexion.js';
import type { CierreCaja, CierrePreview } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { fechaBogotaHoy, rangoDiaBogota } from '../../lib/fechas.js';

interface FilaCierre {
  id: number;
  fecha: string;
  base_inicial: number;
  ventas_efectivo: number;
  ventas_qr: number;
  gastos_efectivo: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  diferencia: number;
  num_pedidos: number;
  nota: string;
  cerrado_por: number;
  creado_en: string;
}

const aCierre = (f: FilaCierre): CierreCaja => ({ ...f });

interface Agregados {
  ventas_efectivo: number;
  ventas_qr: number;
  gastos_efectivo: number;
  num_pedidos: number;
}

// Calcula ventas por método, gastos en efectivo y # de pedidos cobrados del día.
function agregadosDelDia(): Agregados {
  const { desdeUtc, hastaUtc } = rangoDiaBogota();
  const fecha = fechaBogotaHoy();

  const ventas = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN metodo = 'efectivo' THEN monto END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN metodo = 'qr_breb'  THEN monto END), 0) AS qr
       FROM pagos
       WHERE creado_en >= ? AND creado_en < ?`
    )
    .get(desdeUtc, hastaUtc) as { efectivo: number; qr: number };

  const gastos = db
    .prepare(
      "SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE fecha = ? AND metodo = 'efectivo'"
    )
    .get(fecha) as { total: number };

  const pedidos = db
    .prepare(
      "SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'cobrado' AND cerrado_en >= ? AND cerrado_en < ?"
    )
    .get(desdeUtc, hastaUtc) as { n: number };

  return {
    ventas_efectivo: ventas.efectivo,
    ventas_qr: ventas.qr,
    gastos_efectivo: gastos.total,
    num_pedidos: pedidos.n
  };
}

function cierreDeHoy(): FilaCierre | undefined {
  return db.prepare('SELECT * FROM cierres_caja WHERE fecha = ?').get(fechaBogotaHoy()) as
    | FilaCierre
    | undefined;
}

// Base sugerida = base_inicial del último cierre registrado (o 0 si no hay).
function baseSugerida(): number {
  const fila = db
    .prepare('SELECT base_inicial FROM cierres_caja ORDER BY fecha DESC LIMIT 1')
    .get() as { base_inicial: number } | undefined;
  return fila?.base_inicial ?? 0;
}

/** Vista previa del cierre de hoy (o el cierre ya hecho, si existe). */
export function previsualizarCierre(): CierrePreview {
  const agg = agregadosDelDia();
  const abiertos = db
    .prepare("SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'abierto'")
    .get() as { n: number };
  const existente = cierreDeHoy();

  return {
    fecha: fechaBogotaHoy(),
    ...agg,
    base_inicial_sugerida: baseSugerida(),
    pedidos_abiertos: abiertos.n,
    cierre: existente ? aCierre(existente) : null
  };
}

export interface DatosCierre {
  base_inicial: number;
  efectivo_contado: number;
  nota?: string;
}

/**
 * Registra el cierre de hoy. Uno por día: si ya existe, lanza error. Recalcula
 * los agregados de forma autoritativa (no confía en el cliente para las ventas).
 */
export function registrarCierre(datos: DatosCierre, adminId: number): CierreCaja {
  const cerrar = db.transaction((): CierreCaja => {
    if (cierreDeHoy()) throw errores.cajaYaCerrada();

    const agg = agregadosDelDia();
    const efectivo_esperado =
      datos.base_inicial + agg.ventas_efectivo - agg.gastos_efectivo;
    const diferencia = datos.efectivo_contado - efectivo_esperado;

    const info = db
      .prepare(
        `INSERT INTO cierres_caja
           (fecha, base_inicial, ventas_efectivo, ventas_qr, gastos_efectivo,
            efectivo_esperado, efectivo_contado, diferencia, num_pedidos, nota, cerrado_por)
         VALUES
           (@fecha, @base_inicial, @ventas_efectivo, @ventas_qr, @gastos_efectivo,
            @efectivo_esperado, @efectivo_contado, @diferencia, @num_pedidos, @nota, @cerrado_por)`
      )
      .run({
        fecha: fechaBogotaHoy(),
        base_inicial: datos.base_inicial,
        ventas_efectivo: agg.ventas_efectivo,
        ventas_qr: agg.ventas_qr,
        gastos_efectivo: agg.gastos_efectivo,
        efectivo_esperado,
        efectivo_contado: datos.efectivo_contado,
        diferencia,
        num_pedidos: agg.num_pedidos,
        nota: datos.nota ?? '',
        cerrado_por: adminId
      });

    const fila = db
      .prepare('SELECT * FROM cierres_caja WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as FilaCierre;
    return aCierre(fila);
  });

  return cerrar();
}
