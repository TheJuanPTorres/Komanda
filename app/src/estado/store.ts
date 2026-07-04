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
  Sesion
} from '@pos/shared';
import { api } from '../lib/api.js';
import { conectarSocket, desconectarSocket } from '../lib/socket.js';

export function calcularTotal(items: PedidoItem[]): number {
  return items.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
}

interface EstadoApp {
  sesion: Sesion | null;
  cargandoSesion: boolean;
  menu: MenuAgrupado;
  pedidos: PedidoConItems[];

  // Sesión
  cargarSesion: () => Promise<void>;
  entrarAdmin: (pin: string) => Promise<void>;
  entrarAuxiliar: (usuarioId: number) => Promise<void>;
  salir: () => Promise<void>;

  // Datos
  cargarMenu: () => Promise<void>;
  cargarPedidos: () => Promise<void>;

  // Comandos (mutaciones). Devuelven el pedido para poder navegar a él.
  // Aplican la respuesta al estado de una vez; el evento WS que llega
  // después es idempotente (mismo pedido, mismo id).
  abrirMesa: (mesaNumero: number) => Promise<PedidoConItems>;
  crearBarra: (clienteNombre: string) => Promise<PedidoConItems>;
  agregarItem: (pedidoId: number, productoId: number, cantidad?: number) => Promise<void>;
  cambiarCantidad: (pedidoId: number, itemId: number, cantidad: number) => Promise<void>;
  quitarItem: (pedidoId: number, itemId: number) => Promise<PedidoConItems>;
  cambiarNota: (pedidoId: number, nota: string) => Promise<void>;
  cancelarPedido: (pedidoId: number) => Promise<void>;
  cobrar: (pedidoId: number, pagos: PagoReq[]) => Promise<void>;

  // Aplicados por tiempo real o por respuestas de la API (idempotentes).
  aplicarPedido: (p: PedidoConItems) => void;
  quitarPedidoLocal: (pedidoId: number) => void;
  aplicarProducto: (producto: Producto) => void;
}

type RespPedido = { pedido: PedidoConItems };

export const useStore = create<EstadoApp>((set, get) => ({
  sesion: null,
  cargandoSesion: true,
  menu: [],
  pedidos: [],

  cargarSesion: async () => {
    try {
      const { usuario } = await api.get<LoginResp>('/api/auth/sesion');
      set({ sesion: usuario });
      conectarSocket();
    } catch {
      set({ sesion: null });
    } finally {
      set({ cargandoSesion: false });
    }
  },

  entrarAdmin: async (pin) => {
    const { usuario } = await api.post<LoginResp>('/api/auth/admin', { pin });
    set({ sesion: usuario });
    conectarSocket();
  },

  entrarAuxiliar: async (usuarioId) => {
    const { usuario } = await api.post<LoginResp>('/api/auth/auxiliar', { usuarioId });
    set({ sesion: usuario });
    conectarSocket();
  },

  salir: async () => {
    await api.post('/api/auth/salir');
    desconectarSocket();
    set({ sesion: null, pedidos: [], menu: [] });
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
    const { pedido } = await api.post<RespPedido>('/api/pedidos', { tipo: 'barra', clienteNombre });
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

  cancelarPedido: async (pedidoId) => {
    await api.post(`/api/pedidos/${pedidoId}/cancelar`);
    get().quitarPedidoLocal(pedidoId);
  },

  cobrar: async (pedidoId, pagos) => {
    await api.post('/api/cobros', { pedidoId, pagos });
    // El pedido queda cobrado y sale del piso (el evento WS también lo quita).
    get().quitarPedidoLocal(pedidoId);
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
    // Reemplaza el producto dentro del menú agrupado (p. ej. cambió su foto).
    set({
      menu: get().menu.map((cat) => ({
        ...cat,
        productos: cat.productos.map((p) => (p.id === producto.id ? producto : p))
      }))
    });
  }
}));
