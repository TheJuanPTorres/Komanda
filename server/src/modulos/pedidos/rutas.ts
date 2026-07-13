// Rutas de pedidos. Todo cambio de estado emite el evento WS tipado
// correspondiente (el front no hace polling).
//
// Permisos (regla del dueño, reforzada en el servidor):
//  - Agregar items / abrir pedido: cualquier sesión (auxiliar o admin).
//  - Corregir items (reducir cantidad / quitar) en pedido ABIERTO: auxiliar y
//    admin (los auxiliares corrigen errores de digitación; no manejan dinero).
//  - Cobrar y cancelar: SOLO admin (regla sagrada, reforzada en el servidor).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { EventoPedido, PedidoConItems } from '@pos/shared';
import { errores } from '../../lib/errores.js';
import { requiereRol, requiereSesion } from '../auth/middleware.js';
import { emisor } from '../../ws/emisor.js';
import { listarEventos } from './eventos.js';
import {
  abandonarSiVacio,
  abrirMesa,
  agregarItem,
  cambiarCantidad,
  cambiarCliente,
  cambiarNota,
  cancelarPedido,
  crearBarra,
  listarAbiertos,
  obtenerPedidoConItems,
  quitarItem
} from './servicio.js';

// ── Esquemas de validación ────────────────────────────────────────────────

const idParam = z.object({ id: z.coerce.number().int().positive() });
const itemParams = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive()
});

const crearPedidoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mesa'), mesaNumero: z.number().int().min(1).max(4) }),
  // Barra instantánea: el nombre es opcional (el turno identifica el pedido).
  z.object({ tipo: z.literal('barra'), clienteNombre: z.string().trim().max(60).optional() })
]);

// Nombre del cliente de barra: opcional, puede quedar vacío (se limpia).
const cambiarClienteSchema = z.object({ cliente_nombre: z.string().trim().max(60) });

const agregarItemSchema = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(99)
});

const cambiarCantidadSchema = z.object({ cantidad: z.number().int().min(1).max(99) });
const cambiarNotaSchema = z.object({ nota: z.string().max(200) });

// Emite pedido:actualizado a partir del pedido con items ya recalculado.
function emitirActualizado(p: PedidoConItems): void {
  emisor.pedidoActualizado({ pedido: p.pedido, items: p.items });
}

export async function rutasPedidos(app: FastifyInstance): Promise<void> {
  // GET /api/pedidos/abiertos — para pintar el piso.
  app.get('/api/pedidos/abiertos', { preHandler: requiereSesion }, async () => {
    return { pedidos: listarAbiertos() };
  });

  // GET /api/pedidos/:id — un pedido con items y total.
  app.get('/api/pedidos/:id', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    const pedido = obtenerPedidoConItems(id);
    if (!pedido) throw errores.pedidoNoEncontrado();
    return { pedido };
  });

  // GET /api/pedidos/:id/eventos — bitácora del pedido en orden cronológico.
  // SOLO admin: el historial es una herramienta de validación del admin (en el
  // pedido abierto y en la ficha de /ventas). Los auxiliares ya no lo consumen.
  app.get('/api/pedidos/:id/eventos', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const pedido = obtenerPedidoConItems(id);
    if (!pedido) throw errores.pedidoNoEncontrado();
    return { eventos: listarEventos(id) satisfies EventoPedido[] };
  });

  // POST /api/pedidos — abrir mesa (crea o recupera) o crear pedido de barra.
  app.post('/api/pedidos', { preHandler: requiereSesion }, async (req, reply) => {
    const datos = crearPedidoSchema.parse(req.body);

    if (datos.tipo === 'mesa') {
      const { pedido, creado } = abrirMesa(datos.mesaNumero, req.user.id);
      if (creado) emisor.pedidoCreado({ pedido: pedido.pedido, items: pedido.items });
      return reply.status(creado ? 201 : 200).send({ pedido });
    }

    const pedido = crearBarra(datos.clienteNombre ?? null, req.user.id);
    emisor.pedidoCreado({ pedido: pedido.pedido, items: pedido.items });
    return reply.status(201).send({ pedido });
  });

  // POST /api/pedidos/:id/items — agregar producto (suma cantidad si ya está).
  app.post('/api/pedidos/:id/items', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { productoId, cantidad } = agregarItemSchema.parse(req.body);
    const pedido = agregarItem(id, productoId, cantidad, req.user.id);
    emitirActualizado(pedido);
    return { pedido };
  });

  // PATCH /api/pedidos/:id/items/:itemId — reducir cantidad (SOLO admin directo;
  // el auxiliar SOLICITA la corrección, no la ejecuta).
  app.patch('/api/pedidos/:id/items/:itemId', { preHandler: requiereRol('admin') }, async (req) => {
    const { id, itemId } = itemParams.parse(req.params);
    const { cantidad } = cambiarCantidadSchema.parse(req.body);
    const pedido = cambiarCantidad(id, itemId, cantidad, req.user.id);
    emitirActualizado(pedido);
    return { pedido };
  });

  // DELETE /api/pedidos/:id/items/:itemId — quitar línea (SOLO admin directo).
  // Si el pedido queda vacío, se cancela automáticamente.
  app.delete('/api/pedidos/:id/items/:itemId', { preHandler: requiereRol('admin') }, async (req) => {
    const { id, itemId } = itemParams.parse(req.params);
    const { pedido, cancelado } = quitarItem(id, itemId, req.user.id);
    if (cancelado) emisor.pedidoCancelado({ pedidoId: id });
    else emitirActualizado(pedido);
    return { pedido };
  });

  // PATCH /api/pedidos/:id/nota — editar la nota del pedido.
  app.patch('/api/pedidos/:id/nota', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { nota } = cambiarNotaSchema.parse(req.body);
    const pedido = cambiarNota(id, nota, req.user.id);
    emitirActualizado(pedido);
    return { pedido };
  });

  // PATCH /api/pedidos/:id/cliente — nombrar (o renombrar) un pedido de barra.
  // Auxiliar y admin; el nombre es opcional (puede quedar vacío).
  app.patch('/api/pedidos/:id/cliente', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { cliente_nombre } = cambiarClienteSchema.parse(req.body);
    const pedido = cambiarCliente(id, cliente_nombre, req.user.id);
    emitirActualizado(pedido);
    return { pedido };
  });

  // POST /api/pedidos/:id/cancelar — cancelar pedido (SOLO admin).
  app.post('/api/pedidos/:id/cancelar', { preHandler: requiereRol('admin') }, async (req) => {
    const { id } = idParam.parse(req.params);
    cancelarPedido(id, req.user.id);
    emisor.pedidoCancelado({ pedidoId: id });
    return { ok: true };
  });

  // POST /api/pedidos/:id/abandonar — al salir de la toma sin agregar nada, el
  // pedido vacío se elimina (cualquier sesión; el servidor solo actúa si está
  // vacío, así no se abusa para anular pedidos con productos).
  app.post('/api/pedidos/:id/abandonar', { preHandler: requiereSesion }, async (req) => {
    const { id } = idParam.parse(req.params);
    const eliminado = abandonarSiVacio(id, req.user.id);
    if (eliminado) emisor.pedidoCancelado({ pedidoId: id });
    return { eliminado };
  });
}
