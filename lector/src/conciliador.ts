// Concilia un correo de pago con un pago QR registrado en caja.
// Estrategia de cruce: primero por REFERENCIA (exacta, sin distinguir
// mayúsculas); si no hay, por MONTO cuando sea único entre los pagos QR aún
// sin conciliar. Es idempotente por mensaje_id: reprocesar el mismo correo no
// duplica nada.
import { db } from './db.js';
import { extraerPago } from './parser.js';

export interface Correo {
  mensajeId: string | null;
  asunto: string;
  remitente: string;
  fecha: Date | null;
  texto: string;
}

export type ResultadoConciliacion = 'duplicado' | 'conciliado' | 'sin_pago';

interface CandidatoPago {
  id: number;
  monto: number;
  referencia_externa: string | null;
  creado_en: string;
}

const normalizar = (s: string) => s.trim().toLowerCase();

function yaExiste(mensajeId: string | null): boolean {
  if (!mensajeId) return false;
  const fila = db
    .prepare('SELECT 1 FROM notificaciones_pago WHERE mensaje_id = ?')
    .get(mensajeId);
  return fila !== undefined;
}

// Pagos QR que todavía no están conciliados con ningún correo.
function candidatos(): CandidatoPago[] {
  return db
    .prepare(
      `SELECT id, monto, referencia_externa, creado_en
         FROM pagos
        WHERE metodo = 'qr_breb'
          AND id NOT IN (SELECT pago_id FROM notificaciones_pago WHERE pago_id IS NOT NULL)`
    )
    .all() as CandidatoPago[];
}

function buscarPago(monto: number | null, referencia: string | null): CandidatoPago | null {
  const lista = candidatos();

  // 1) Por referencia exacta.
  if (referencia) {
    const ref = normalizar(referencia);
    const porRef = lista.find(
      (c) => c.referencia_externa && normalizar(c.referencia_externa) === ref
    );
    if (porRef) return porRef;
  }

  // 2) Por monto, solo si es único (evita cruces ambiguos).
  if (monto !== null) {
    const porMonto = lista.filter((c) => c.monto === monto);
    if (porMonto.length === 1) return porMonto[0]!;
  }

  return null;
}

function aFechaSqlite(fecha: Date | null): string | null {
  if (!fecha || Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Procesa un correo: lo guarda (idempotente) y trata de conciliarlo con un
 * pago. Devuelve el resultado ('duplicado' | 'conciliado' | 'sin_pago').
 */
export function procesarCorreo(correo: Correo): ResultadoConciliacion {
  if (yaExiste(correo.mensajeId)) return 'duplicado';

  const { monto, referencia } = extraerPago(correo.texto);

  const operar = db.transaction((): ResultadoConciliacion => {
    // Reverificación dentro de la transacción por si otro ciclo lo insertó.
    if (yaExiste(correo.mensajeId)) return 'duplicado';

    const pago = buscarPago(monto, referencia);
    const estado: ResultadoConciliacion = pago ? 'conciliado' : 'sin_pago';

    db.prepare(
      `INSERT INTO notificaciones_pago
         (mensaje_id, asunto, remitente, monto, referencia, fecha_correo, pago_id, estado, crudo)
       VALUES (@mensaje_id, @asunto, @remitente, @monto, @referencia, @fecha_correo, @pago_id, @estado, @crudo)`
    ).run({
      mensaje_id: correo.mensajeId,
      asunto: correo.asunto.slice(0, 300),
      remitente: correo.remitente.slice(0, 200),
      monto,
      referencia,
      fecha_correo: aFechaSqlite(correo.fecha),
      pago_id: pago?.id ?? null,
      estado,
      crudo: correo.texto.slice(0, 2000)
    });

    // Si el pago no tenía referencia guardada, se completa con la del correo.
    if (pago && !pago.referencia_externa && referencia) {
      db.prepare('UPDATE pagos SET referencia_externa = ? WHERE id = ?').run(referencia, pago.id);
    }

    return estado;
  });

  return operar();
}
