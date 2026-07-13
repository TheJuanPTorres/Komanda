// Estado global de la app (Zustand). Guarda la sesión, el menú y los pedidos
// abiertos. Los pedidos se mantienen al día por eventos WS (ver tiempoReal.ts),
// nunca por polling.
import { create } from 'zustand';
import type {
  LoginResp,
  MenuAgrupado,
  PagoReq,
  PedidoConItems,
  PedidoItem,
  Producto,
  PulsoDia,
  Sesion,
  SolicitarCorreccionReq,
  SolicitudCorreccion
} from '@pos/shared';
import { api } from '../lib/api.js';
import { conectarSocket, desconectarSocket } from '../lib/socket.js';

export function calcularTotal(items: PedidoItem[]): number {
  return items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
}

interface EstadoApp {
  sesion: Sesion | null;
  cargandoSesion: boolean;
  // El admin con PIN corto heredado debe renovarlo antes de operar.
  debeCambiarPin: boolean;
  menu: MenuAgrupado;
  pedidos: PedidoConItems[];
  // Solicitudes de corrección PENDIENTES conocidas por esta sesión.
  correcciones: SolicitudCorreccion[];
  // Aviso breve global (toast), p. ej. "Tu corrección fue aprobada".
  aviso: string | null;
  // Pulso del día (dinero y # de ventas de hoy); admin. Abiertos y correcciones
  // se derivan en vivo de `pedidos` y `correcciones`.
  pulso: PulsoDia | null;

  // Sesión
  cargarSesion: () => Promise<void>;
  entrarAdmin: (pin: string) => Promise<void>;
  entrarAuxiliar: (usuarioId: number, pin: string) => Promise<void>;
  cambiarMiPin: (pinNuevo: string) => Promise<void>;
  salir: () => Promise<void>;

  // Datos
  cargarMenu: () => Promise<void>;
  cargarPedidos: () => Promise<void>;

  // Comandos (mutaciones). Devuelven el pedido para poder navegar a él.
  // Aplican la respuesta al estado de una vez; el evento WS que llega
  // después es idempotente (mismo pedido, mismo id).
  abrirMesa: (mesaNumero: number) => Promise<PedidoConItems>;
  // Barra instantánea: el nombre es opcional (el turno identifica el pedido).
  crearBarra: (clienteNombre?: string | null) => Promise<PedidoConItems>;
  agregarItem: (pedidoId: number, productoId: number, cantidad?: number) => Promise<void>;
  // Suma 1 con feedback OPTIMISTA: la cantidad sube al instante y se reconcilia
  // con el servidor; si el servidor rechaza, revierte y avisa (Parte 5.4).
  sumarItem: (
    pedidoId: number,
    producto: { id: number; nombre: string; precio: number; costo?: number }
  ) => Promise<void>;
  cambiarCantidad: (pedidoId: number, itemId: number, cantidad: number) => Promise<void>;
  quitarItem: (pedidoId: number, itemId: number) => Promise<PedidoConItems>;
  cambiarNota: (pedidoId: number, nota: string) => Promise<void>;
  cambiarCliente: (pedidoId: number, clienteNombre: string) => Promise<void>;
  cancelarPedido: (pedidoId: number) => Promise<void>;
  cobrar: (pedidoId: number, pagos: PagoReq[]) => Promise<void>;

  // Correcciones (v1.5-B)
  cargarCorrecciones: () => Promise<void>; // admin: todas las pendientes
  cargarCorreccionesPedido: (pedidoId: number) => Promise<void>; // por pedido
  solicitarCorreccion: (pedidoId: number, itemId: number, req: SolicitarCorreccionReq) => Promise<void>;
  aprobarCorreccion: (id: number) => Promise<void>;
  rechazarCorreccion: (id: number) => Promise<void>;
  mostrarAviso: (texto: string) => void;
  cargarPulso: () => Promise<void>;

  // Aplicados por tiempo real o por respuestas de la API (idempotentes).
  aplicarPedido: (p: PedidoConItems) => void;
  quitarPedidoLocal: (pedidoId: number) => void;
  aplicarProducto: (producto: Producto) => void;
  aplicarCorreccion: (s: SolicitudCorreccion) => void; // agregar/reemplazar pendiente
  resolverCorreccionLocal: (id: number) => void; // quitar de pendientes
  quitarCorreccionesDePedido: (pedidoId: number) => void; // al cancelar
}

type RespPedido = { pedido: PedidoConItems };

export const useStore = create<EstadoApp>((set, get) => ({
  sesion: null,
  cargandoSesion: true,
  debeCambiarPin: false,
  menu: [],
  pedidos: [],
  correcciones: [],
  aviso: null,
  pulso: null,

  cargarSesion: async () => {
    try {
      const { usuario, debe_cambiar_pin } = await api.get<LoginResp>('/api/auth/sesion');
      set({ sesion: usuario, debeCambiarPin: Boolean(debe_cambiar_pin) });
      conectarSocket();
    } catch {
      set({ sesion: null });
    } finally {
      set({ cargandoSesion: false });
    }
  },

  entrarAdmin: async (pin) => {
    const { usuario, debe_cambiar_pin } = await api.post<LoginResp>('/api/auth/admin', { pin });
    set({ sesion: usuario, debeCambiarPin: Boolean(debe_cambiar_pin) });
    conectarSocket();
  },

  entrarAuxiliar: async (usuarioId, pin) => {
    const { usuario, debe_cambiar_pin } = await api.post<LoginResp>('/api/auth/auxiliar', {
      usuarioId,
      pin
    });
    set({ sesion: usuario, debeCambiarPin: Boolean(debe_cambiar_pin) });
    conectarSocket();
  },

  cambiarMiPin: async (pinNuevo) => {
    await api.post('/api/auth/cambiar-pin', { pin_nuevo: pinNuevo });
    set({ debeCambiarPin: false });
  },

  salir: async () => {
    await api.post('/api/auth/salir');
    desconectarSocket();
    set({ sesion: null, debeCambiarPin: false, pedidos: [], menu: [], correcciones: [], aviso: null, pulso: null });
  },

  cargarMenu: async () => {
    const { menu } = await api.get<{ menu: MenuAgrupado }>('/api/menu');
    set({ menu });
  },

  cargarPedidos: async () => {
    const { pedidos } = await api.get<{ pedidos: PedidoConItems[] }>('/api/pedidos/abiertos');
    set({ pedidos });
  },

  abrirMesa: async (mesaNumero) => {
    const { pedido } = await api.post<RespPedido>('/api/pedidos', { tipo: 'mesa', mesaNumero });
    get().aplicarPedido(pedido);
    return pedido;
  },

  crearBarra: async (clienteNombre) => {
    const nombre = clienteNombre && clienteNombre.trim() ? clienteNombre.trim() : undefined;
    const { pedido } = await api.post<RespPedido>('/api/pedidos', {
      tipo: 'barra',
      clienteNombre: nombre
    });
    get().aplicarPedido(pedido);
    return pedido;
  },

  agregarItem: async (pedidoId, productoId, cantidad = 1) => {
    const { pedido } = await api.post<RespPedido>(`/api/pedidos/${pedidoId}/items`, {
      productoId,
      cantidad
    });
    get().aplicarPedido(pedido);
  },

  sumarItem: async (pedidoId, producto) => {
    const previo = get().pedidos.find((p) => p.pedido.id === pedidoId);
    if (!previo) {
      // Sin copia local todavía: cae al camino normal (sin optimismo).
      await get().agregarItem(pedidoId, producto.id);
      return;
    }
    // 1) Optimista: sube 1 al instante (item existente o línea temporal).
    const existente = previo.items.find((it) => it.producto_id === producto.id);
    const items: PedidoItem[] = existente
      ? previo.items.map((it) =>
          it.producto_id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it
        )
      : [
          ...previo.items,
          {
            id: -producto.id, // id temporal negativo; el servidor manda el real
            pedido_id: pedidoId,
            producto_id: producto.id,
            nombre_producto: producto.nombre,
            precio_unitario: producto.precio,
            costo_unitario: producto.costo ?? 0,
            cantidad: 1,
            agregado_por: get().sesion?.id ?? 0,
            agregado_en: new Date().toISOString()
          }
        ];
    get().aplicarPedido({ pedido: previo.pedido, items, total: calcularTotal(items) });

    // 2) Reconciliar con el servidor; si rechaza, revertir + avisar.
    try {
      const { pedido } = await api.post<RespPedido>(`/api/pedidos/${pedidoId}/items`, {
        productoId: producto.id,
        cantidad: 1
      });
      get().aplicarPedido(pedido);
    } catch {
      get().aplicarPedido(previo); // revierte al estado anterior
      get().mostrarAviso(`No se pudo agregar ${producto.nombre}. Intenta de nuevo.`);
    }
  },

  cambiarCantidad: async (pedidoId, itemId, cantidad) => {
    const { pedido } = await api.patch<RespPedido>(
      `/api/pedidos/${pedidoId}/items/${itemId}`,
      { cantidad }
    );
    get().aplicarPedido(pedido);
  },

  quitarItem: async (pedidoId, itemId) => {
    const { pedido } = await api.delete<RespPedido>(`/api/pedidos/${pedidoId}/items/${itemId}`);
    get().aplicarPedido(pedido);
    return pedido;
  },

  cambiarNota: async (pedidoId, nota) => {
    const { pedido } = await api.patch<RespPedido>(`/api/pedidos/${pedidoId}/nota`, { nota });
    get().aplicarPedido(pedido);
  },

  cambiarCliente: async (pedidoId, clienteNombre) => {
    const { pedido } = await api.patch<RespPedido>(`/api/pedidos/${pedidoId}/cliente`, {
      cliente_nombre: clienteNombre
    });
    get().aplicarPedido(pedido);
  },

  cancelarPedido: async (pedidoId) => {
    await api.post(`/api/pedidos/${pedidoId}/cancelar`);
    get().quitarPedidoLocal(pedidoId);
  },

  cobrar: async (pedidoId, pagos) => {
    await api.post('/api/cobros', { pedidoId, pagos });
    // El pedido queda cobrado y sale del piso (el evento WS también lo quita).
    get().quitarPedidoLocal(pedidoId);
  },

  // ── Correcciones ─────────────────────────────────────────────────────────
  cargarCorrecciones: async () => {
    const { solicitudes } = await api.get<{ solicitudes: SolicitudCorreccion[] }>('/api/correcciones');
    set({ correcciones: solicitudes });
  },

  cargarCorreccionesPedido: async (pedidoId) => {
    const { solicitudes } = await api.get<{ solicitudes: SolicitudCorreccion[] }>(
      `/api/pedidos/${pedidoId}/correcciones`
    );
    // Reemplaza las de este pedido por las recién traídas (deja el resto).
    const otras = get().correcciones.filter((c) => c.pedido_id !== pedidoId);
    set({ correcciones: [...otras, ...solicitudes] });
  },

  solicitarCorreccion: async (pedidoId, itemId, req) => {
    const { solicitud } = await api.post<{ solicitud: SolicitudCorreccion }>(
      `/api/pedidos/${pedidoId}/items/${itemId}/correccion`,
      req
    );
    get().aplicarCorreccion(solicitud);
  },

  aprobarCorreccion: async (id) => {
    await api.post(`/api/correcciones/${id}/aprobar`);
    get().resolverCorreccionLocal(id);
  },

  rechazarCorreccion: async (id) => {
    await api.post(`/api/correcciones/${id}/rechazar`);
    get().resolverCorreccionLocal(id);
  },

  mostrarAviso: (texto) => {
    set({ aviso: texto });
    window.setTimeout(() => {
      if (get().aviso === texto) set({ aviso: null });
    }, 3000);
  },

  cargarPulso: async () => {
    const pulso = await api.get<PulsoDia>('/api/pulso');
    set({ pulso });
  },

  aplicarCorreccion: (s) => {
    if (s.estado !== 'pendiente') {
      get().resolverCorreccionLocal(s.id);
      return;
    }
    const otras = get().correcciones.filter((c) => c.id !== s.id);
    set({ correcciones: [...otras, s].sort((a, b) => a.creado_en.localeCompare(b.creado_en)) });
  },

  resolverCorreccionLocal: (id) => {
    set({ correcciones: get().correcciones.filter((c) => c.id !== id) });
  },

  quitarCorreccionesDePedido: (pedidoId) => {
    set({ correcciones: get().correcciones.filter((c) => c.pedido_id !== pedidoId) });
  },

  aplicarPedido: (p) => {
    const otros = get().pedidos.filter((x) => x.pedido.id !== p.pedido.id);
    // Solo mantenemos en el piso los pedidos que siguen abiertos.
    const siguientes = p.pedido.estado === 'abierto' ? [...otros, p] : otros;
    siguientes.sort((a, b) => a.pedido.creado_en.localeCompare(b.pedido.creado_en));
    set({ pedidos: siguientes });
  },

  quitarPedidoLocal: (pedidoId) => {
    set({ pedidos: get().pedidos.filter((x) => x.pedido.id !== pedidoId) });
  },

  aplicarProducto: (producto) => {
    // Mantiene el menú vivo ante cambios de producto (foto, precio, alta, baja).
    // Un producto inactivo o de categoría desconocida se retira del menú; si es
    // nuevo y activo, se agrega a su categoría; si ya está, se reemplaza.
    const menu = get().menu.map((cat) => {
      const sinEl = cat.productos.filter((p) => p.id !== producto.id);
      const pertenece = producto.activo && producto.categoria_id === cat.id;
      const productos = pertenece
        ? [...sinEl, producto].sort((a, b) => a.nombre.localeCompare(b.nombre))
        : sinEl;
      return { ...cat, productos };
    });
    set({ menu });
  }
}));
