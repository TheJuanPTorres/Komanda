// Registro de cobros. REGLA SAGRADA: solo el admin llega aquí (las rutas usan
// requiereRol('admin')); además este servicio valida la integridad del cobro.
import { db } from '../../db/conexion.js';
import type { Pago, PagoReq } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { obtenerPedidoConItems } from '../pedidos/servicio.js';
import { registrarEvento } from '../pedidos/eventos.js';
import { hayPendientesEnPedido } from '../correcciones/datos.js';

export interface ResultadoCobro {
  pedidoId: number;
  cerrado_en: string;
  pagos: Pago[];
}

/**
 * Cobra un pedido: valida que esté abierto, que tenga total > 0 y que la suma
 * de los pagos sea exactamente el total; inserta los pagos (qr/efectivo con
 * verificado=1, confirmado por el admin) y cierra el pedido. Todo atómico.
 */
export function registrarCobro(
  pedidoId: number,
  pagos: PagoReq[],
  adminId: number
): ResultadoCobro {
  const cobrar = db.transaction((): ResultadoCobro => {
    const actual = obtenerPedidoConItems(pedidoId);
    if (!actual) throw errores.pedidoNoEncontrado();
    if (actual.pedido.estado !== 'abierto') throw errores.pedidoNoAbierto();
    // No se puede cobrar con correcciones pendientes: hay que resolverlas antes.
    if (hayPendientesEnPedido(pedidoId)) throw errores.cobroConPendientes();
    if (actual.total <= 0) throw errores.cobroVacio();

    const suma = pagos.reduce((acc, p) => acc + p.monto, 0);
    if (suma !== actual.total) throw errores.montoNoCuadra();

    const insertar = db.prepare(
      `INSERT INTO pagos
         (pedido_id, metodo, monto, referencia_externa, verificado, registrado_por)
       VALUES (?, ?, ?, ?, 1, ?)`
    );
    for (const p of pagos) {
      insertar.run(pedidoId, p.metodo, p.monto, p.referencia_externa ?? null, adminId);
    }

    db.prepare(
      "UPDATE pedidos SET estado = 'cobrado', cerrado_en = datetime('now'), cerrado_por = ? WHERE id = ?"
    ).run(adminId, pedidoId);

    registrarEvento({
      pedidoId,
      usuarioId: adminId,
      tipo: 'cobrado',
      detalle: {
        total: actual.total,
        pagos: pagos.map((p) => ({ metodo: p.metodo, monto: p.monto }))
      }
    });

    const pedido = obtenerPedidoConItems(pedidoId)!;
    const filasPago = db
      .prepare('SELECT * FROM pagos WHERE pedido_id = ? ORDER BY id')
      .all(pedidoId) as FilaPago[];

    return {
      pedidoId,
      cerrado_en: pedido.pedido.cerrado_en!,
      pagos: filasPago.map(aPago)
    };
  });

  return cobrar();
}

interface FilaPago {
  id: number;
  pedido_id: number;
  metodo: 'efectivo' | 'qr_breb';
  monto: number;
  referencia_externa: string | null;
  verificado: number;
  registrado_por: number;
  creado_en: string;
}

function aPago(f: FilaPago): Pago {
  return {
    id: f.id,
    pedido_id: f.pedido_id,
    metodo: f.metodo,
    monto: f.monto,
    referencia_externa: f.referencia_externa,
    verificado: f.verificado === 1,
    registrado_por: f.registrado_por,
    creado_en: f.creado_en
  };
}
