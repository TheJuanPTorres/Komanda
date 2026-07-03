// Tomar pedido: menú a la izquierda, cuenta a la derecha.
// Meseros solo AGREGAN (tocando productos). Quitar/ajustar cantidad y cancelar
// son acciones de admin (se ven solo para admin y el servidor las refuerza).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PedidoConItems } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { pesos } from '../../lib/dinero.js';
import { turnoBarra } from '../../lib/etiquetas.js';
import { Boton, Cargando } from '../../design-system/primitivas/index.js';
import { CobroModal } from '../cobro/CobroModal.js';
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

  const pedido = pedidos.find((p) => p.pedido.id === pedidoId);
  const [buscando, setBuscando] = useState(!pedido);
  const [error, setError] = useState('');
  const [cobrando, setCobrando] = useState(false);

  // Asegura menú y pedido cargados si se entró directo por URL.
  useEffect(() => {
    if (menu.length === 0) cargarMenu().catch(() => {});
  }, [menu.length, cargarMenu]);

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
    // Solo al montar / cambiar de id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  // Mapa producto_id -> cantidad en la cuenta, para el badge del menú.
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

  if (buscando) return <Cargando pantalla />;

  // El pedido ya no está abierto (cobrado/cancelado por otro dispositivo).
  if (!pedido) {
    return (
      <div className="pedido">
        <div className="pedido__cargando pila" style={{ gap: 'var(--esp-4)' }}>
          <p>Este pedido ya no está abierto.</p>
          <Boton onClick={() => navegar('/')}>Volver al piso</Boton>
        </div>
      </div>
    );
  }

  const { pedido: p, items, total } = pedido;
  const titulo = p.tipo === 'mesa' ? `Mesa ${p.mesa_numero}` : turnoBarra(p.turno);
  const subtitulo = p.tipo === 'barra' ? p.cliente_nombre ?? '' : 'Mesa';

  return (
    <div className="pedido">
      <header className="pedido__enc">
        <button className="pedido__volver" onClick={() => navegar('/')} aria-label="Volver">
          ‹
        </button>
        <div className="pedido__titulo">
          <strong>{titulo}</strong>
          <span>{subtitulo}</span>
        </div>
        <div className="pedido__enc-total">
          <span>Total</span>
          <strong>{pesos(total)}</strong>
        </div>
      </header>

      <div className="pedido__cols">
        {/* Menú */}
        <div className="menu">
          {error && <div className="acceso__error" style={{ marginBottom: 'var(--esp-3)' }}>{error}</div>}
          {menu.map((cat) => (
            <section className="menu__cat" key={cat.id}>
              <h3 className="menu__cat-titulo">{cat.nombre}</h3>
              <div className="menu__grid">
                {cat.productos.map((prod) => {
                  const cant = cantidadPorProducto.get(prod.id);
                  const sinStock = prod.controla_stock && prod.stock <= 0;
                  return (
                    <button
                      key={prod.id}
                      className="producto"
                      disabled={sinStock}
                      onClick={() => conManejo(() => agregarItem(p.id, prod.id))}
                    >
                      {cant ? <span className="producto__cantidad">{cant}</span> : null}
                      <span className="producto__nombre">{prod.nombre}</span>
                      <span className="producto__precio">
                        {sinStock ? 'Agotado' : pesos(prod.precio)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Cuenta */}
        <aside className="cuenta">
          <div className="cuenta__lista">
            {items.length === 0 ? (
              <div className="cuenta__vacia">
                Toca productos del menú para agregarlos al pedido.
              </div>
            ) : (
              items.map((it) => (
                <div className="item" key={it.id}>
                  <div className="item__info">
                    <div className="item__nombre">{it.nombre_producto}</div>
                    <div className="item__sub">
                      {pesos(it.precio_unitario)} · {pesos(it.precio_unitario * it.cantidad)}
                    </div>
                  </div>

                  {esAdmin ? (
                    <>
                      <button
                        className="paso"
                        aria-label="Menos"
                        onClick={() =>
                          conManejo(() =>
                            it.cantidad <= 1
                              ? quitarItem(p.id, it.id)
                              : cambiarCantidad(p.id, it.id, it.cantidad - 1)
                          )
                        }
                      >
                        −
                      </button>
                      <span className="item__cant">{it.cantidad}</span>
                      <button
                        className="paso"
                        aria-label="Más"
                        onClick={() => conManejo(() => cambiarCantidad(p.id, it.id, it.cantidad + 1))}
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <span className="item__cant">×{it.cantidad}</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="cuenta__pie">
            <div className="cuenta__total">
              <span>Total</span>
              <strong>{pesos(total)}</strong>
            </div>
            {esAdmin && (
              <>
                <Boton bloque grande disabled={total <= 0} onClick={() => setCobrando(true)}>
                  Cobrar {pesos(total)}
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
    </div>
  );
}
