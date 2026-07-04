// Tipos de dominio compartidos entre servidor y app.
// Regla de oro del proyecto: el DINERO siempre es un entero (pesos COP).
// Las FECHAS son TEXT ISO 8601 en UTC tal como las guarda SQLite (datetime('now')).

export type Rol = 'admin' | 'auxiliar';
export type EstadoNotificacion = 'pendiente' | 'conciliado' | 'sin_pago';
export type TipoPedido = 'mesa' | 'barra';
export type EstadoPedido = 'abierto' | 'cobrado' | 'cancelado';
export type MetodoPago = 'efectivo' | 'qr_breb';
export type CategoriaGasto = 'insumos' | 'servicios' | 'nomina' | 'otros';

// ── Entidades ──────────────────────────────────────────────────────────────

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  // pin_hash NUNCA viaja al cliente; por eso no está en esta interfaz pública.
  activo: boolean;
  creado_en: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface Producto {
  id: number;
  categoria_id: number | null;
  nombre: string;
  precio: number;
  costo: number;
  controla_stock: boolean;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  // Ruta relativa de la foto (p. ej. "/imagenes/5.webp"), o null si no tiene.
  imagen: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Pedido {
  id: number;
  tipo: TipoPedido;
  mesa_numero: number | null;
  cliente_nombre: string | null;
  turno: number | null;
  estado: EstadoPedido;
  auxiliar_id: number;
  nota: string;
  creado_en: string;
  cerrado_en: string | null;
  cerrado_por: number | null;
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number;
  nombre_producto: string;
  precio_unitario: number;
  costo_unitario: number;
  cantidad: number;
  agregado_por: number;
  agregado_en: string;
}

export interface Pago {
  id: number;
  pedido_id: number;
  metodo: MetodoPago;
  monto: number;
  referencia_externa: string | null;
  verificado: boolean;
  registrado_por: number;
  creado_en: string;
}

export interface Gasto {
  id: number;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  metodo: MetodoPago;
  nota: string;
  registrado_por: number;
  fecha: string;
  creado_en: string;
}

export interface CierreCaja {
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

// ── Sesión ───────────────────────────────────────────────────────────────

// Contenido del JWT y de GET /api/auth/sesion.
export interface Sesion {
  id: number;
  nombre: string;
  rol: Rol;
}

// ── Contratos de la API (request / response) ─────────────────────────────

export interface LoginAdminReq {
  pin: string;
}

export interface LoginAuxiliarReq {
  usuarioId: number;
}

export interface LoginResp {
  usuario: Sesion;
}

// ── Administración de productos y auxiliares (admin) ─────────────────────

// Crear o editar un producto. La foto se maneja por su propio endpoint.
export interface GuardarProductoReq {
  categoria_id: number;
  nombre: string;
  precio: number;
  costo: number;
  controla_stock: boolean;
  stock: number;
  stock_minimo: number;
}

// Crear o renombrar un auxiliar (sin PIN: entra por selección de nombre).
export interface GuardarAuxiliarReq {
  nombre: string;
}

export interface SaludResp {
  ok: true;
  version: string;
  uptime: number;
}

// Forma única de todas las respuestas de error del servidor.
export interface ErrorResp {
  error: {
    codigo: string;
    mensaje: string;
  };
}

// ── Menú (lectura para tomar pedido) ─────────────────────────────────────

// Una categoría activa con sus productos activos, para pintar el menú.
export interface CategoriaConProductos extends Categoria {
  productos: Producto[];
}

// El menú completo agrupado por categoría, en orden.
export type MenuAgrupado = CategoriaConProductos[];

// ── Pedidos (DTOs de lectura) ────────────────────────────────────────────

// Un pedido con sus items y el total ya calculado (entero COP).
// El total lo calcula el servidor: suma de precio_unitario * cantidad.
export interface PedidoConItems {
  pedido: Pedido;
  items: PedidoItem[];
  total: number;
}

// ── Pedidos (requests) ───────────────────────────────────────────────────

// Crear un pedido. Para 'mesa' se exige mesa_numero (1–4); si esa mesa ya
// tiene un pedido abierto, el servidor devuelve ese en vez de crear otro.
// Para 'barra' se exige cliente_nombre; el turno lo asigna el servidor.
export type CrearPedidoReq =
  | { tipo: 'mesa'; mesaNumero: number }
  | { tipo: 'barra'; clienteNombre: string };

// Agregar un producto al pedido. Si ya está, se suma la cantidad.
export interface AgregarItemReq {
  productoId: number;
  cantidad: number;
}

// Cambiar la cantidad de una línea (solo admin).
export interface CambiarCantidadReq {
  cantidad: number;
}

// Editar la nota del pedido.
export interface CambiarNotaReq {
  nota: string;
}

// ── Cobro (Fase 3) ───────────────────────────────────────────────────────

// Un pago dentro del cobro. Para efectivo, `monto` es lo que cubre la cuenta
// (el vuelto no viaja: no es venta). Para qr_breb, `referencia_externa` es
// opcional. La suma de los montos debe ser exactamente el total del pedido.
export interface PagoReq {
  metodo: MetodoPago;
  monto: number;
  referencia_externa?: string;
}

// Registrar el cobro de un pedido (solo admin). Cierra el pedido.
export interface RegistrarCobroReq {
  pedidoId: number;
  pagos: PagoReq[];
}

export interface CobroResp {
  pedidoId: number;
  cerrado_en: string;
  pagos: Pago[];
}

// ── Gastos (Fase 4) ──────────────────────────────────────────────────────

export interface CrearGastoReq {
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  metodo: MetodoPago;
  nota?: string;
}

// ── Cierre de caja (Fase 4) ──────────────────────────────────────────────

// Vista previa del cierre del día: agregados calculados por el servidor.
// El efectivo esperado y la diferencia dependen de lo que el admin escriba
// (base_inicial y efectivo_contado), así que se calculan en vivo en la UI y
// el servidor los recalcula de forma autoritativa al registrar.
export interface CierrePreview {
  fecha: string; // día calendario de Bogotá (YYYY-MM-DD)
  ventas_efectivo: number;
  ventas_qr: number;
  gastos_efectivo: number;
  num_pedidos: number;
  base_inicial_sugerida: number; // base del cierre anterior, o 0
  pedidos_abiertos: number; // aviso: pedidos aún sin cobrar
  cierre: CierreCaja | null; // si ya se cerró hoy, va aquí (solo lectura)
}

export interface RegistrarCierreReq {
  base_inicial: number;
  efectivo_contado: number;
  nota?: string;
}

// ── Reportes (Fase 5) ────────────────────────────────────────────────────
// Todos los reportes cuentan SOLO pedidos cobrados. El rango va por día de
// Bogotá. El margen usa los snapshots de precio/costo de pedido_items.

// Un rango de fechas en días calendario de Bogotá (YYYY-MM-DD, inclusivos).
export interface RangoFechas {
  desde: string;
  hasta: string;
}

export interface MargenProducto {
  producto_id: number;
  nombre: string;
  unidades: number;
  ingresos: number; // suma precio_unitario * cantidad
  costo: number; // suma costo_unitario * cantidad
  margen: number; // ingresos - costo
  margen_pct: number; // margen / ingresos * 100 (0 si no hubo ingresos)
}

export interface ReporteMargen {
  rango: RangoFechas;
  productos: MargenProducto[];
  totales: Omit<MargenProducto, 'producto_id' | 'nombre'>;
  // Nº de productos activos con costo 0 (margen no confiable mientras > 0).
  productos_sin_costo: number;
}

export interface VentasPorDia {
  fecha: string; // YYYY-MM-DD (Bogotá)
  efectivo: number;
  qr: number;
  total: number;
  num_pedidos: number;
}

export interface VentasPorHora {
  hora: number; // 0–23 (hora de Bogotá)
  total: number;
  num_pedidos: number;
}

export interface ReporteVentas {
  rango: RangoFechas;
  por_dia: VentasPorDia[];
  por_hora: VentasPorHora[];
  totales: {
    efectivo: number;
    qr: number;
    total: number;
    num_pedidos: number;
    ticket_promedio: number;
  };
}

// ── Conciliación de pagos QR (Fase 7) ────────────────────────────────────
// Un pago QR "conciliado" es el que tiene un correo del banco que lo respalda.
// El lector (proceso aparte) llena notificaciones_pago; aquí solo se lee.

export interface NotificacionPago {
  id: number;
  mensaje_id: string | null;
  asunto: string;
  remitente: string;
  monto: number | null;
  referencia: string | null;
  fecha_correo: string | null;
  pago_id: number | null;
  estado: EstadoNotificacion;
  creado_en: string;
}

// Un pago QR que aún no tiene correo del banco que lo respalde.
export interface PagoSinConciliar {
  pago_id: number;
  pedido_id: number;
  monto: number;
  referencia_externa: string | null;
  creado_en: string;
}

export interface ReporteConciliacion {
  rango: RangoFechas;
  resumen: {
    pagos_qr: number; // # de pagos QR en el rango
    conciliados: number; // # de pagos QR con correo del banco
    pagos_sin_correo: number; // pagos QR sin correo (revisar)
    correos_sin_pago: number; // correos del banco sin pago (revisar)
  };
  // Correos del banco que no cruzaron con ningún pago registrado.
  sin_pago: NotificacionPago[];
  // Pagos QR sin un correo que los respalde.
  pagos_sin_conciliar: PagoSinConciliar[];
}

// ── Bitácora de eventos de pedido (v1.5, Etapa A) ────────────────────────
// Tabla inmutable pedido_eventos: cada mutación de un pedido escribe un evento.
// El campo `detalle` es un JSON cuyo contenido depende del `tipo` (unión
// discriminada más abajo). Los montos son enteros COP; `nombre` es snapshot
// del momento (no se resuelve luego con join).

export type TipoEventoPedido =
  | 'creado'
  | 'item_agregado'
  | 'item_reducido'
  | 'item_eliminado'
  | 'nota_editada'
  | 'cancelado'
  | 'cobrado';

export interface DetalleCreado {
  tipo_pedido: TipoPedido;
  mesa_numero?: number;
  cliente_nombre?: string;
  turno?: number;
  items_iniciales: {
    producto_id: number;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}

export interface DetalleItemAgregado {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface DetalleItemReducido {
  producto_id: number;
  nombre: string;
  cantidad_antes: number;
  cantidad_despues: number;
  stock_devuelto: number;
}

export interface DetalleItemEliminado {
  producto_id: number;
  nombre: string;
  cantidad_eliminada: number;
  monto_eliminado: number;
  stock_devuelto: number;
}

export interface DetalleNotaEditada {
  nota_antes: string;
  nota_despues: string;
}

export interface DetalleCancelado {
  motivo: 'manual' | 'quedo_vacio';
  total_al_cancelar: number;
}

export interface DetalleCobrado {
  total: number;
  pagos: { metodo: MetodoPago; monto: number }[];
}

// Unión discriminada por `tipo`: al estrechar por tipo, `detalle` queda tipado.
export type EventoContenido =
  | { tipo: 'creado'; detalle: DetalleCreado }
  | { tipo: 'item_agregado'; detalle: DetalleItemAgregado }
  | { tipo: 'item_reducido'; detalle: DetalleItemReducido }
  | { tipo: 'item_eliminado'; detalle: DetalleItemEliminado }
  | { tipo: 'nota_editada'; detalle: DetalleNotaEditada }
  | { tipo: 'cancelado'; detalle: DetalleCancelado }
  | { tipo: 'cobrado'; detalle: DetalleCobrado };

// Un evento tal como lo devuelve la API: contenido + metadatos + nombre de
// usuario ya resuelto (para la línea de tiempo).
export type EventoPedido = EventoContenido & {
  id: number;
  pedido_id: number;
  usuario_id: number;
  usuario_nombre: string;
  creado_en: string;
};
