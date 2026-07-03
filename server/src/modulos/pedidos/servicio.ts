// Acceso a datos y reglas de negocio de los pedidos.
// Reglas confirmadas con el dueño:
//  - Mesa (1–4): un solo pedido abierto por mesa.
//  - Barra: el servidor asigna turno secuencial del día (hora Bogotá).
//  - Item repetido: se suma la cantidad en la línea existente.
//  - Snapshot: al agregar se copia nombre/precio/costo del producto.
//  - Quitar/reducir items: solo admin (se refuerza en las rutas).
import { db } from '../../db/conexion.js';
import type { Pedido, PedidoConItems, PedidoItem } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { rangoDiaBogota } from '../../lib/fechas.js';
import { obtenerProductoActivo } from '../productos/servicio.js';

interface FilaPedido {
  id: number;
  tipo: 'mesa' | 'barra';
  mesa_numero: number | null;
  cliente_nombre: string | null;
  turno: number | null;
  estado: 'abierto' | 'cobrado' | 'cancelado';
  mesero_id: number;
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
  meseroId: number
): { pedido: PedidoConItems; creado: boolean } {
  const abrir = db.transaction(() => {
    const existente = pedidoAbiertoEnMesa(mesaNumero);
    if (existente) return { id: existente.id, creado: false };
    const info = db
      .prepare("INSERT INTO pedidos (tipo, mesa_numero, mesero_id) VALUES ('mesa', ?, ?)")
      .run(mesaNumero, meseroId);
    return { id: Number(info.lastInsertRowid), creado: true };
  });
  const { id, creado } = abrir();
  return { pedido: obtenerPedidoConItems(id)!, creado };
}

// Siguiente turno del día para barra (máximo del día + 1), en hora Bogotá.
function siguienteTurnoBarra(): number {
  const { desdeUtc, hastaUtc } = rangoDiaBogota();
  const fila = db
    .prepare(
      "SELECT MAX(turno) AS maximo FROM pedidos WHERE tipo = 'barra' AND creado_en >= ? AND creado_en < ?"
    )
    .get(desdeUtc, hastaUtc) as { maximo: number | null };
  return (fila.maximo ?? 0) + 1;
}

/** Crea un pedido de barra con turno secuencial del día asignado por el servidor. */
export function crearBarra(clienteNombre: string, meseroId: number): PedidoConItems {
  const crear = db.transaction(() => {
    const turno = siguienteTurnoBarra();
    const info = db
      .prepare(
        "INSERT INTO pedidos (tipo, turno, cliente_nombre, mesero_id) VALUES ('barra', ?, ?, ?)"
      )
      .run(turno, clienteNombre, meseroId);
    return Number(info.lastInsertRowid);
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
  });
  operar();
  return obtenerPedidoConItems(pedidoId)!;
}

/** Cambia la cantidad de una línea (solo admin). Cantidad 0 no se permite (usar quitar). */
export function cambiarCantidad(pedidoId: number, itemId: number, cantidad: number): PedidoConItems {
  const operar = db.transaction(() => {
    exigirAbierto(pedidoId);
    const info = db
      .prepare('UPDATE pedido_items SET cantidad = ? WHERE id = ? AND pedido_id = ?')
      .run(cantidad, itemId, pedidoId);
    if (info.changes === 0) throw errores.itemNoEncontrado();
  });
  operar();
  return obtenerPedidoConItems(pedidoId)!;
}

/** Quita una línea del pedido (solo admin). */
export function quitarItem(pedidoId: number, itemId: number): PedidoConItems {
  const operar = db.transaction(() => {
    exigirAbierto(pedidoId);
    const info = db
      .prepare('DELETE FROM pedido_items WHERE id = ? AND pedido_id = ?')
      .run(itemId, pedidoId);
    if (info.changes === 0) throw errores.itemNoEncontrado();
  });
  operar();
  return obtenerPedidoConItems(pedidoId)!;
}

/** Edita la nota del pedido. */
export function cambiarNota(pedidoId: number, nota: string): PedidoConItems {
  exigirAbierto(pedidoId);
  db.prepare('UPDATE pedidos SET nota = ? WHERE id = ?').run(nota, pedidoId);
  return obtenerPedidoConItems(pedidoId)!;
}

/** Cancela un pedido abierto (solo admin). */
export function cancelarPedido(pedidoId: number, adminId: number): void {
  const operar = db.transaction(() => {
    exigirAbierto(pedidoId);
    db.prepare(
      "UPDATE pedidos SET estado = 'cancelado', cerrado_en = datetime('now'), cerrado_por = ? WHERE id = ?"
    ).run(adminId, pedidoId);
  });
  operar();
}
