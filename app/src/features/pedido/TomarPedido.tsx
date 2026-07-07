// Tomar pedido: menú (TarjetaProducto) + cuenta (LineaPedido + DisplayTotal).
// Tocar un producto agrega 1. Cada línea tiene −/+/eliminar: auxiliares y
// admin pueden corregir el pedido ABIERTO (el servidor lo refuerza). Si al
// eliminar el pedido queda vacío, se cancela solo. Cobrar/cancelar: solo admin.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PedidoConItems, PedidoItem } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { turnoBarra } from '../../lib/etiquetas.js';
import {
  Boton,
  DisplayTotal,
  LineaPedido,
  Modal,
  TarjetaProducto,
  formatearDinero
} from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { Cargando } from '../comunes/Cargando.js';
import { CobroModal } from '../cobro/CobroModal.js';
import { HistorialPedido } from './HistorialPedido.js';
import { SolicitarCorreccionModal } from './SolicitarCorreccionModal.js';
import './pedido.css';

export function TomarPedido() {
  const { id } = useParams();
  const pedidoId = Number(id);
  const navegar = useNavigate();

  const sesion = useStore((s) => s.sesion);
  const esAdmin = sesion?.rol === 'admin';
  const menu = useStore((s) => s.menu);
  const pedidos = useStore((s) => s.pedidos);
  const cargarMenu = useStore((s) => s.cargarMenu);
  const agregarItem = useStore((s) => s.agregarItem);
  const cambiarCantidad = useStore((s) => s.cambiarCantidad);
  const quitarItem = useStore((s) => s.quitarItem);
  const cancelarPedido = useStore((s) => s.cancelarPedido);
  const aplicarPedido = useStore((s) => s.aplicarPedido);
  const correcciones = useStore((s) => s.correcciones);
  const cargarCorreccionesPedido = useStore((s) => s.cargarCorreccionesPedido);

  const pedido = pedidos.find((p) => p.pedido.id === pedidoId);
  const [buscando, setBuscando] = useState(!pedido);
  const [error, setError] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [porEliminar, setPorEliminar] = useState<PedidoItem | null>(null);
  const [porCorregir, setPorCorregir] = useState<PedidoItem | null>(null);

  // Solicitudes pendientes de ESTE pedido (para el distintivo y el bloqueo de cobro).
  const pendientesPedido = correcciones.filter((c) => c.pedido_id === pedidoId);
  const itemsPendientes = new Set(pendientesPedido.map((c) => c.item_id));

  useEffect(() => {
    if (menu.length === 0) cargarMenu().catch(() => {});
  }, [menu.length, cargarMenu]);

  // Carga las correcciones pendientes de este pedido (se mantienen por WS).
  useEffect(() => {
    cargarCorreccionesPedido(pedidoId).catch(() => {});
  }, [pedidoId, cargarCorreccionesPedido]);

  useEffect(() => {
    if (pedido) {
      setBuscando(false);
      return;
    }
    let vivo = true;
    api
      .get<{ pedido: PedidoConItems }>(`/api/pedidos/${pedidoId}`)
      .then((r) => vivo && aplicarPedido(r.pedido))
      .catch(() => {})
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  const cantidadPorProducto = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of pedido?.items ?? []) m.set(it.producto_id, it.cantidad);
    return m;
  }, [pedido]);

  async function conManejo(accion: () => Promise<void>) {
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo completar la acción.');
    }
  }

  if (buscando) return <Cargando />;

  // El pedido ya no está abierto (cobrado/cancelado por otro dispositivo).
  if (!pedido) {
    return (
      <div className="pedido__salida">
        <strong>Ese pedido ya cerró.</strong>
        <Boton flujo onClick={() => navegar('/')}>
          Volver al piso
        </Boton>
      </div>
    );
  }

  const { pedido: p, items, total } = pedido;
  const titulo = p.tipo === 'mesa' ? `Mesa ${p.mesa_numero}` : turnoBarra(p.turno);
  const subtitulo = p.tipo === 'barra' ? p.cliente_nombre ?? '' : 'Mesa';

  return (
    <div className="pedido">
      <Encabezado
        titulo={titulo}
        subtitulo={subtitulo}
        onVolver={() => navegar('/')}
        acciones={<span className="pedido__total-enc">{formatearDinero(total)}</span>}
      />

      <div className="pedido__cols">
        {/* Menú */}
        <div className="pedido__menu">
          {error && <div className="aviso-error">{error}</div>}
          {menu.map((cat) => (
            <section key={cat.id}>
              <h3 className="seccion-titulo">{cat.nombre}</h3>
              <div className="pedido__cat-grid">
                {cat.productos.map((prod) => {
                  const controla = prod.controla_stock;
                  return (
                    <TarjetaProducto
                      key={prod.id}
                      nombre={prod.nombre}
                      precio={prod.precio}
                      imagen={prod.imagen}
                      cantidad={cantidadPorProducto.get(prod.id) ?? 0}
                      stock={controla ? prod.stock : undefined}
                      agotado={controla && prod.stock <= 0}
                      onAgregar={() => conManejo(() => agregarItem(p.id, prod.id))}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Cuenta */}
        <aside className="pedido__cuenta">
          <div className="pedido__lista">
            {items.length === 0 ? (
              <p className="vacio">
                <strong>Cuenta vacía.</strong>
                Toca el menú para ir sumando.
              </p>
            ) : (
              items.map((it) => (
                <LineaPedido
                  key={it.id}
                  cantidad={it.cantidad}
                  nombre={it.nombre_producto}
                  subtotal={it.precio_unitario * it.cantidad}
                  pendiente={itemsPendientes.has(it.id)}
                  // Ambos pueden AGREGAR. El admin corrige directo; el auxiliar
                  // SOLICITA (reducir/eliminar pasa por aprobación).
                  onMas={() => conManejo(() => agregarItem(p.id, it.producto_id))}
                  onMenos={
                    esAdmin && it.cantidad > 1
                      ? () => conManejo(() => cambiarCantidad(p.id, it.id, it.cantidad - 1))
                      : undefined
                  }
                  onEliminar={esAdmin ? () => setPorEliminar(it) : undefined}
                  onSolicitar={!esAdmin ? () => setPorCorregir(it) : undefined}
                />
              ))
            )}

            <HistorialPedido pedidoId={p.id} revision={items.length * 100000 + total} />
          </div>

          <div className="pedido__pie">
            <DisplayTotal monto={total} />
            {esAdmin && (
              <>
                {pendientesPedido.length > 0 && (
                  <button className="pedido__aviso-corr" onClick={() => navegar('/correcciones')}>
                    {pendientesPedido.length} corrección(es) pendiente(s) — resuélvelas para cobrar
                  </button>
                )}
                <Boton
                  flujo
                  bloque
                  disabled={total <= 0 || pendientesPedido.length > 0}
                  onClick={() => setCobrando(true)}
                >
                  Cobrar {formatearDinero(total)}
                </Boton>
                <Boton
                  variante="peligro"
                  bloque
                  onClick={() =>
                    conManejo(async () => {
                      await cancelarPedido(p.id);
                      navegar('/');
                    })
                  }
                >
                  Cancelar pedido
                </Boton>
              </>
            )}
          </div>
        </aside>
      </div>

      {cobrando && esAdmin && (
        <CobroModal
          pedidoId={p.id}
          total={total}
          onCerrar={() => setCobrando(false)}
          onCobrado={() => navegar('/')}
        />
      )}

      {porCorregir && (
        <SolicitarCorreccionModal
          pedidoId={p.id}
          item={porCorregir}
          onCerrar={() => setPorCorregir(null)}
        />
      )}

      {porEliminar && (
        <Modal titulo="¿Quitar este producto?" onCerrar={() => setPorEliminar(null)}>
          <p className="ds-modal__consecuencia">
            Se quita “{porEliminar.nombre_producto}” del pedido. Si es lo último, el pedido se
            cancela.
          </p>
          <div className="ds-modal__acciones">
            <Boton variante="secundario" bloque onClick={() => setPorEliminar(null)}>
              Volver
            </Boton>
            <Boton
              variante="peligro"
              bloque
              onClick={() => {
                const it = porEliminar;
                setPorEliminar(null);
                conManejo(async () => {
                  const actualizado = await quitarItem(p.id, it.id);
                  // Si el pedido quedó vacío, el servidor lo canceló: volver al piso.
                  if (actualizado.pedido.estado !== 'abierto') navegar('/');
                });
              }}
            >
              Sí, quitar
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
