// Acceso a datos y reglas de negocio de los pedidos.
// Reglas confirmadas con el dueño:
//  - Mesa (1–4): un solo pedido abierto por mesa.
//  - Barra: el servidor asigna turno secuencial del día (hora Bogotá).
//  - Item repetido: se suma la cantidad en la línea existente.
//  - Snapshot: al agregar se copia nombre/precio/costo del producto.
//  - Corregir items (reducir/quitar): auxiliar y admin, solo si está abierto.
//  - Stock: si el producto lo controla, agregar descuenta y quitar/reducir
//    devuelve al inventario (misma transacción). Los cambios de stock emiten
//    producto:actualizado para refrescar el menú en vivo.
import { db } from '../../db/conexion.js';
import type { OrigenCorreccion, Pedido, PedidoConItems, PedidoItem } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { rangoDiaOperativo } from '../../lib/fechas.js';
import { emisor } from '../../ws/emisor.js';
import { obtenerProducto, obtenerProductoActivo } from '../productos/servicio.js';
import { registrarEvento } from './eventos.js';

// Total (entero COP) de una lista de items del pedido.
function totalItems(items: { precio_unitario: number; cantidad: number }[]): number {
  return items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
}

// Ajusta el stock de un producto (solo si lo controla). Devuelve true si cambió.
// Debe llamarse DENTRO de una transacción; la emisión WS va después del commit.
function ajustarStock(productoId: number, delta: number): boolean {
  const info = db
    .prepare(
      "UPDATE productos SET stock = stock + ?, actualizado_en = datetime('now') WHERE id = ? AND controla_stock = 1"
    )
    .run(delta, productoId);
  return info.changes > 0;
}

// Emite producto:actualizado para cada producto cuyo stock cambió.
function emitirProductos(ids: Iterable<number>): void {
  for (const id of new Set(ids)) {
    const p = obtenerProducto(id);
    if (p) emisor.productoActualizado({ producto: p });
  }
}

// Exige que el pedido esté abierto para CORREGIRLO; si no, 403 (no editable).
function exigirEditable(id: number): Pedido {
  const pedido = obtenerPedido(id);
  if (!pedido) throw errores.pedidoNoEncontrado();
  if (pedido.estado !== 'abierto') throw errores.pedidoNoEditable();
  return pedido;
}

interface FilaPedido {
  id: number;
  tipo: 'mesa' | 'barra';
  mesa_numero: number | null;
  cliente_nombre: string | null;
  turno: number | null;
  estado: 'abierto' | 'cobrado' | 'cancelado';
  auxiliar_id: number;
  nota: string;
  creado_en: string;
  cerrado_en: string | null;
  cerrado_por: number | null;
}

type FilaItem = PedidoItem;

// ── Lecturas ──────────────────────────────────────────────────────────────

function itemsDe(pedidoId: number): PedidoItem[] {
  return db
    .prepare('SELECT * FROM pedido_items WHERE pedido_id = ? ORDER BY id')
    .all(pedidoId) as FilaItem[];
}

function totalDe(items: PedidoItem[]): number {
  // Dinero en enteros COP: suma de precio_unitario * cantidad.
  return items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
}

function armar(pedido: Pedido): PedidoConItems {
  const items = itemsDe(pedido.id);
  return { pedido, items, total: totalDe(items) };
}

export function obtenerPedido(id: number): Pedido | undefined {
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as
    | FilaPedido
    | undefined;
}

/** Un pedido con sus items y total, o undefined si no existe. */
export function obtenerPedidoConItems(id: number): PedidoConItems | undefined {
  const pedido = obtenerPedido(id);
  return pedido ? armar(pedido) : undefined;
}

/** Todos los pedidos abiertos (mesa y barra) con items y total, para el piso. */
export function listarAbiertos(): PedidoConItems[] {
  const pedidos = db
    .prepare("SELECT * FROM pedidos WHERE estado = 'abierto' ORDER BY creado_en")
    .all() as FilaPedido[];
  return pedidos.map(armar);
}

function pedidoAbiertoEnMesa(mesaNumero: number): FilaPedido | undefined {
  return db
    .prepare("SELECT * FROM pedidos WHERE tipo = 'mesa' AND mesa_numero = ? AND estado = 'abierto'")
    .get(mesaNumero) as FilaPedido | undefined;
}

// Devuelve un pedido abierto y garantiza que se pueda mutar; si no, lanza error.
function exigirAbierto(id: number): Pedido {
  const pedido = obtenerPedido(id);
  if (!pedido) throw errores.pedidoNoEncontrado();
  if (pedido.estado !== 'abierto') throw errores.pedidoNoAbierto();
  return pedido;
}

// ── Crear ──────────────────────────────────────────────────────────────────

/**
 * Abre (o recupera) el pedido de una mesa. Si la mesa ya tiene un pedido
 * abierto, devuelve ese mismo con creado=false; si no, crea uno con creado=true.
 */
export function abrirMesa(
  mesaNumero: number,
  auxiliarId: number
): { pedido: PedidoConItems; creado: boolean } {
  const abrir = db.transaction(() => {
    const existente = pedidoAbiertoEnMesa(mesaNumero);
    if (existente) return { id: existente.id, creado: false };
    const info = db
      .prepare("INSERT INTO pedidos (tipo, mesa_numero, auxiliar_id) VALUES ('mesa', ?, ?)")
      .run(mesaNumero, auxiliarId);
    const id = Number(info.lastInsertRowid);
    registrarEvento({
      pedidoId: id,
      usuarioId: auxiliarId,
      tipo: 'creado',
      detalle: { tipo_pedido: 'mesa', mesa_numero: mesaNumero, items_iniciales: [] }
    });
    return { id, creado: true };
  });
  const { id, creado } = abrir();
  return { pedido: obtenerPedidoConItems(id)!, creado };
}

// Siguiente turno del día para barra (máximo del día + 1), en hora Bogotá.
function siguienteTurnoBarra(): number {
  const { desdeUtc, hastaUtc } = rangoDiaOperativo();
  const fila = db
    .prepare(
      "SELECT MAX(turno) AS maximo FROM pedidos WHERE tipo = 'barra' AND creado_en >= ? AND creado_en < ?"
    )
    .get(desdeUtc, hastaUtc) as { maximo: number | null };
  return (fila.maximo ?? 0) + 1;
}

/**
 * Crea un pedido de barra con turno secuencial del día asignado por el servidor.
 * El nombre del cliente es OPCIONAL (barra instantánea): el pedido se identifica
 * por su turno. Se puede nombrar después con cambiarCliente().
 */
export function crearBarra(clienteNombre: string | null, auxiliarId: number): PedidoConItems {
  const nombre = clienteNombre && clienteNombre.trim() ? clienteNombre.trim() : null;
  const crear = db.transaction(() => {
    const turno = siguienteTurnoBarra();
    const info = db
      .prepare(
        "INSERT INTO pedidos (tipo, turno, cliente_nombre, auxiliar_id) VALUES ('barra', ?, ?, ?)"
      )
      .run(turno, nombre, auxiliarId);
    const id = Number(info.lastInsertRowid);
    registrarEvento({
      pedidoId: id,
      usuarioId: auxiliarId,
      tipo: 'creado',
      detalle: {
        tipo_pedido: 'barra',
        // El nombre solo se guarda en el evento si el auxiliar lo escribió.
        ...(nombre ? { cliente_nombre: nombre } : {}),
        turno,
        items_iniciales: []
      }
    });
    return id;
  });
  return obtenerPedidoConItems(crear())!;
}

// ── Items ────────────────────────────────────────────────────────────────

/**
 * Agrega un producto al pedido. Si el producto ya está en el pedido, suma la
 * cantidad a la línea existente. Copia el snapshot (nombre/precio/costo).
 */
export function agregarItem(
  pedidoId: number,
  productoId: number,
  cantidad: number,
  usuarioId: number
): PedidoConItems {
  const operar = db.transaction(() => {
    exigirAbierto(pedidoId);
    const producto = obtenerProductoActivo(productoId);
    if (!producto) throw errores.productoNoDisponible();

    const existente = db
      .prepare('SELECT * FROM pedido_items WHERE pedido_id = ? AND producto_id = ?')
      .get(pedidoId, productoId) as FilaItem | undefined;

    if (existente) {
      db.prepare('UPDATE pedido_items SET cantidad = cantidad + ? WHERE id = ?').run(
        cantidad,
        existente.id
      );
    } else {
      db.prepare(
        `INSERT INTO pedido_items
           (pedido_id, producto_id, nombre_producto, precio_unitario, costo_unitario, cantidad, agregado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(pedidoId, productoId, producto.nombre, producto.precio, producto.costo, cantidad, usuarioId);
    }
    // Descuenta del inventario si el producto controla stock.
    const afectado = ajustarStock(productoId, -cantidad) ? productoId : null;
    registrarEvento({
      pedidoId,
      usuarioId,
      tipo: 'item_agregado',
      detalle: {
        producto_id: productoId,
        nombre: producto.nombre,
        cantidad,
        precio_unitario: producto.precio
      }
    });
    return afectado;
  });
  const afectado = operar();
  if (afectado !== null) emitirProductos([afectado]);
  return obtenerPedidoConItems(pedidoId)!;
}

/** Un item del pedido por id (o undefined). */
export function itemDe(pedidoId: number, itemId: number): FilaItem | undefined {
  return db
    .prepare('SELECT * FROM pedido_items WHERE id = ? AND pedido_id = ?')
    .get(itemId, pedidoId) as FilaItem | undefined;
}

/**
 * EJECUTA la reducción de una línea DENTRO de una transacción ya abierta. No
 * emite WS: devuelve el producto afectado para emitir tras el commit. `origen`
 * marca el evento cuando la reducción viene de aprobar una solicitud. Lo usan
 * tanto el admin directo como la aprobación de correcciones.
 */
export function ejecutarReducir(
  item: FilaItem,
  cantidadNueva: number,
  ejecutorId: number,
  origen?: OrigenCorreccion
): number | null {
  const antes = item.cantidad;
  db.prepare('UPDATE pedido_items SET cantidad = ? WHERE id = ?').run(cantidadNueva, item.id);
  const ajusto = ajustarStock(item.producto_id, antes - cantidadNueva); // devuelve al inventario
  registrarEvento({
    pedidoId: item.pedido_id,
    usuarioId: ejecutorId,
    tipo: 'item_reducido',
    detalle: {
      producto_id: item.producto_id,
      nombre: item.nombre_producto,
      cantidad_antes: antes,
      cantidad_despues: cantidadNueva,
      stock_devuelto: ajusto ? antes - cantidadNueva : 0,
      ...origen
    }
  });
  return ajusto ? item.producto_id : null;
}

/**
 * EJECUTA la eliminación de una línea DENTRO de una transacción ya abierta. Si
 * el pedido queda vacío, autocancela (registrando quién lo dejó vacío). No
 * emite WS. Devuelve el producto afectado y si el pedido se canceló.
 */
export function ejecutarEliminar(
  item: FilaItem,
  ejecutorId: number,
  origen?: OrigenCorreccion
): { afectado: number | null; cancelado: boolean } {
  const pedidoId = item.pedido_id;
  db.prepare('DELETE FROM pedido_items WHERE id = ?').run(item.id);
  const ajusto = ajustarStock(item.producto_id, item.cantidad);
  registrarEvento({
    pedidoId,
    usuarioId: ejecutorId,
    tipo: 'item_eliminado',
    detalle: {
      producto_id: item.producto_id,
      nombre: item.nombre_producto,
      cantidad_eliminada: item.cantidad,
      monto_eliminado: item.precio_unitario * item.cantidad,
      stock_devuelto: ajusto ? item.cantidad : 0,
      ...origen
    }
  });
  const quedan = db
    .prepare('SELECT COUNT(*) AS n FROM pedido_items WHERE pedido_id = ?')
    .get(pedidoId) as { n: number };
  let cancelado = false;
  if (quedan.n === 0) {
    db.prepare(
      "UPDATE pedidos SET estado = 'cancelado', cerrado_en = datetime('now'), cerrado_por = ? WHERE id = ?"
    ).run(ejecutorId, pedidoId);
    registrarEvento({
      pedidoId,
      usuarioId: ejecutorId,
      tipo: 'cancelado',
      detalle: { motivo: 'quedo_vacio', total_al_cancelar: 0 }
    });
    cancelado = true;
  }
  return { afectado: ajusto ? item.producto_id : null, cancelado };
}

/**
 * Cambia la cantidad de una línea (SOLO admin directo; el auxiliar solicita).
 * Al bajar, ejecuta la reducción; al subir (poco común), lo registra como
 * agregado para no falsear la bitácora.
 */
export function cambiarCantidad(
  pedidoId: number,
  itemId: number,
  cantidad: number,
  usuarioId: number
): PedidoConItems {
  const operar = db.transaction(() => {
    exigirEditable(pedidoId);
    const item = itemDe(pedidoId, itemId);
    if (!item) throw errores.itemNoEncontrado();
    if (cantidad === item.cantidad) return null; // sin cambio, sin evento
    if (cantidad < item.cantidad) return ejecutarReducir(item, cantidad, usuarioId);
    // Subir: descuenta stock y registra un item_agregado por la diferencia.
    db.prepare('UPDATE pedido_items SET cantidad = ? WHERE id = ?').run(cantidad, itemId);
    const ajusto = ajustarStock(item.producto_id, item.cantidad - cantidad);
    registrarEvento({
      pedidoId,
      usuarioId,
      tipo: 'item_agregado',
      detalle: {
        producto_id: item.producto_id,
        nombre: item.nombre_producto,
        cantidad: cantidad - item.cantidad,
        precio_unitario: item.precio_unitario
      }
    });
    return ajusto ? item.producto_id : null;
  });
  const afectado = operar();
  if (afectado !== null) emitirProductos([afectado]);
  return obtenerPedidoConItems(pedidoId)!;
}

/** Quita una línea (SOLO admin directo; el auxiliar solicita). */
export function quitarItem(
  pedidoId: number,
  itemId: number,
  usuarioId: number
): { pedido: PedidoConItems; cancelado: boolean } {
  const operar = db.transaction((): { afectado: number | null; cancelado: boolean } => {
    exigirEditable(pedidoId);
    const item = itemDe(pedidoId, itemId);
    if (!item) throw errores.itemNoEncontrado();
    return ejecutarEliminar(item, usuarioId);
  });
  const { afectado, cancelado } = operar();
  if (afectado !== null) emitirProductos([afectado]);
  return { pedido: obtenerPedidoConItems(pedidoId)!, cancelado };
}

/** Edita la nota del pedido. */
export function cambiarNota(pedidoId: number, nota: string, usuarioId: number): PedidoConItems {
  const operar = db.transaction(() => {
    const pedido = exigirAbierto(pedidoId);
    const notaAntes = pedido.nota;
    if (nota === notaAntes) return; // sin cambio, sin evento
    db.prepare('UPDATE pedidos SET nota = ? WHERE id = ?').run(nota, pedidoId);
    registrarEvento({
      pedidoId,
      usuarioId,
      tipo: 'nota_editada',
      detalle: { campo: 'nota', antes: notaAntes, despues: nota }
    });
  });
  operar();
  return obtenerPedidoConItems(pedidoId)!;
}

/**
 * Edita el nombre del cliente de un pedido de barra (barra instantánea). Puede
 * dejarse vacío (vuelve a null). Registra un evento nota_editada con
 * campo='cliente_nombre'. Auxiliar y admin, solo sobre pedidos abiertos.
 */
export function cambiarCliente(pedidoId: number, clienteNombre: string, usuarioId: number): PedidoConItems {
  const nombre = clienteNombre.trim();
  const operar = db.transaction(() => {
    const pedido = exigirAbierto(pedidoId);
    if (pedido.tipo !== 'barra') throw errores.pedidoNoEditable();
    const antes = pedido.cliente_nombre ?? '';
    if (nombre === antes) return; // sin cambio, sin evento
    db.prepare('UPDATE pedidos SET cliente_nombre = ? WHERE id = ?').run(nombre || null, pedidoId);
    registrarEvento({
      pedidoId,
      usuarioId,
      tipo: 'nota_editada',
      detalle: { campo: 'cliente_nombre', antes, despues: nombre }
    });
  });
  operar();
  return obtenerPedidoConItems(pedidoId)!;
}

/** Cancela un pedido abierto (solo admin). Devuelve el stock de sus items. */
export function cancelarPedido(pedidoId: number, adminId: number): void {
  const operar = db.transaction((): number[] => {
    exigirAbierto(pedidoId);
    const items = db
      .prepare('SELECT producto_id, cantidad, precio_unitario FROM pedido_items WHERE pedido_id = ?')
      .all(pedidoId) as { producto_id: number; cantidad: number; precio_unitario: number }[];
    const afectados: number[] = [];
    for (const it of items) {
      if (ajustarStock(it.producto_id, it.cantidad)) afectados.push(it.producto_id);
    }
    db.prepare(
      "UPDATE pedidos SET estado = 'cancelado', cerrado_en = datetime('now'), cerrado_por = ? WHERE id = ?"
    ).run(adminId, pedidoId);
    // Anula las solicitudes de corrección pendientes del pedido (misma tx).
    db.prepare(
      "UPDATE solicitudes_correccion SET estado = 'anulada', resuelto_por = ?, resuelto_en = datetime('now') WHERE pedido_id = ? AND estado = 'pendiente'"
    ).run(adminId, pedidoId);
    registrarEvento({
      pedidoId,
      usuarioId: adminId,
      tipo: 'cancelado',
      detalle: { motivo: 'manual', total_al_cancelar: totalItems(items) }
    });
    return afectados;
  });
  emitirProductos(operar());
}
