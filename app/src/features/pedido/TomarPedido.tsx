// Tomar pedido (rediseño móvil v1.5-C). El menú es una lista de UNA fila por
// producto (FilaMenu); una barra de chips sticky salta a cada categoría y el
// total va sticky y compacto arriba. Abajo, una barra de acción fija en la zona
// del pulgar. Sumar es optimista (la cantidad sube al instante). Ambos roles
// AGREGAN; el admin corrige directo y el auxiliar SOLICITA (el servidor refuerza
// la regla). El historial es solo del admin.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import type { PedidoConItems, PedidoItem, Producto } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { contarUnidades, refBarra } from '../../lib/etiquetas.js';
import {
  Boton,
  Chip,
  DisplayTotal,
  FilaMenu,
  Modal,
  formatearDinero
} from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { Cargando } from '../comunes/Cargando.js';
import { CobroModal } from '../cobro/CobroModal.js';
import { HistorialPedido } from './HistorialPedido.js';
import { SolicitarCorreccionModal } from './SolicitarCorreccionModal.js';
import './pedido.css';

interface Seccion {
  key: string;
  nombre: string;
  productos: Producto[];
}

export function TomarPedido() {
  const { id } = useParams();
  const pedidoId = Number(id);
  const navegar = useNavigate();

  const sesion = useStore((s) => s.sesion);
  const esAdmin = sesion?.rol === 'admin';
  const menu = useStore((s) => s.menu);
  const pedidos = useStore((s) => s.pedidos);
  const cargarMenu = useStore((s) => s.cargarMenu);
  const sumarItem = useStore((s) => s.sumarItem);
  const cambiarCantidad = useStore((s) => s.cambiarCantidad);
  const quitarItem = useStore((s) => s.quitarItem);
  const cambiarCliente = useStore((s) => s.cambiarCliente);
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
  const [catActiva, setCatActiva] = useState<string>('');
  const [nombre, setNombre] = useState('');

  // Solicitudes pendientes de ESTE pedido (distintivo + bloqueo de cobro).
  const pendientesPedido = correcciones.filter((c) => c.pedido_id === pedidoId);
  const itemsPendientes = new Set(pendientesPedido.map((c) => c.item_id));

  // Refs a cada sección para el salto por chip y el resaltado por scroll.
  const cuerpoRef = useRef<HTMLDivElement | null>(null);
  const seccionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (menu.length === 0) cargarMenu().catch(() => {});
  }, [menu.length, cargarMenu]);

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

  // Sincroniza el campo de nombre con el pedido (barra) cuando llega/cambia.
  useEffect(() => {
    if (pedido?.pedido.tipo === 'barra') setNombre(pedido.pedido.cliente_nombre ?? '');
  }, [pedido?.pedido.cliente_nombre, pedido?.pedido.tipo]);

  const secciones = useMemo<Seccion[]>(
    () => menu.map((c) => ({ key: `c${c.id}`, nombre: c.nombre, productos: c.productos })),
    [menu]
  );

  // Chip activo por defecto: la primera categoría.
  useEffect(() => {
    if (secciones.length > 0 && !secciones.some((s) => s.key === catActiva)) {
      setCatActiva(secciones[0]!.key);
    }
  }, [secciones, catActiva]);

  const itemPorProducto = useMemo(() => {
    const m = new Map<number, PedidoItem>();
    for (const it of pedido?.items ?? []) m.set(it.producto_id, it);
    return m;
  }, [pedido]);

  // Resalta el chip de la sección visible mientras se hace scroll.
  useEffect(() => {
    const raiz = cuerpoRef.current;
    if (!raiz || secciones.length === 0) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCatActiva(visible.target.getAttribute('data-cat') ?? '');
      },
      { root: raiz, rootMargin: '-96px 0px -55% 0px', threshold: 0 }
    );
    for (const s of secciones) {
      const el = seccionRefs.current[s.key];
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [secciones]);

  function irACategoria(key: string) {
    setCatActiva(key);
    seccionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function conManejo(accion: () => Promise<void>) {
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo completar la acción.');
    }
  }

  function sumar(prod: Producto) {
    setError('');
    // Optimista: no usa conManejo (la reversión y el aviso los da el store).
    void sumarItem(pedidoId, {
      id: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      costo: prod.costo
    });
  }

  // Bajar 1: el admin reduce directo (o elimina si es el último); el auxiliar
  // SOLICITA la corrección (no ejecuta). El servidor refuerza la regla.
  function restar(prod: Producto) {
    if (!pedido) return;
    const it = itemPorProducto.get(prod.id);
    if (!it) return;
    if (esAdmin) {
      if (it.cantidad > 1) conManejo(() => cambiarCantidad(pedido.pedido.id, it.id, it.cantidad - 1));
      else setPorEliminar(it);
    } else {
      setPorCorregir(it);
    }
  }

  function guardarNombre() {
    if (!pedido || pedido.pedido.tipo !== 'barra') return;
    const limpio = nombre.trim();
    if (limpio === (pedido.pedido.cliente_nombre ?? '')) return;
    conManejo(() => cambiarCliente(pedido.pedido.id, limpio));
  }

  if (buscando) return <Cargando />;

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
  const esBarra = p.tipo === 'barra';
  const titulo = esBarra ? refBarra(p.turno, p.cliente_nombre) : `Mesa ${p.mesa_numero}`;
  const unidades = contarUnidades(items);
  const bloqueaCobro = total <= 0 || pendientesPedido.length > 0;

  return (
    <div className="toma">
      <Encabezado titulo={titulo} subtitulo={esBarra ? 'Barra' : 'Mesa'} onVolver={() => navegar('/')} />

      {/* Franja sticky: nombre (barra) + total compacto + chips de categoría. */}
      <div className="toma__sticky">
        {esBarra && (
          <input
            className="toma__nombre"
            value={nombre}
            maxLength={60}
            placeholder="Nombre (opcional)"
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Nombre del cliente (opcional)"
          />
        )}
        <DisplayTotal monto={total} compacto />
        {secciones.length > 1 && (
          <div className="toma__chips">
            {secciones.map((s) => (
              <Chip key={s.key} activo={catActiva === s.key} onClick={() => irACategoria(s.key)}>
                {s.nombre}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="toma__cuerpo" ref={cuerpoRef}>
        {error && <div className="aviso-error">{error}</div>}

        {secciones.map((s) => (
          <section
            key={s.key}
            className="toma__seccion"
            data-cat={s.key}
            ref={(el) => {
              seccionRefs.current[s.key] = el;
            }}
          >
            <h3 className="seccion-titulo">{s.nombre}</h3>
            <div className="toma__filas">
              {s.productos.map((prod) => {
                const controla = prod.controla_stock;
                const it = itemPorProducto.get(prod.id);
                return (
                  <FilaMenu
                    key={prod.id}
                    nombre={prod.nombre}
                    precio={prod.precio}
                    imagen={prod.imagen}
                    cantidad={it?.cantidad ?? 0}
                    stock={controla ? prod.stock : undefined}
                    agotado={controla && prod.stock <= 0}
                    pendiente={it ? itemsPendientes.has(it.id) : false}
                    onSumar={() => sumar(prod)}
                    onRestar={() => restar(prod)}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {/* Historial: herramienta de validación SOLO del admin (Parte 2.3). */}
        {esAdmin && (
          <div className="toma__pie-admin">
            <HistorialPedido pedidoId={p.id} revision={items.length * 100000 + total} />
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
          </div>
        )}
      </div>

      {/* Aviso de correcciones pendientes (bloquea el cobro), sobre la barra. */}
      {esAdmin && pendientesPedido.length > 0 && (
        <button className="toma__aviso-corr" onClick={() => navegar('/correcciones')}>
          {pendientesPedido.length} corrección(es) pendiente(s) — resuélvelas para cobrar
        </button>
      )}

      {/* Barra de acción inferior fija (zona del pulgar). */}
      <div className="toma__accion">
        {esAdmin ? (
          <Boton flujo bloque disabled={bloqueaCobro} onClick={() => setCobrando(true)}>
            Cobrar {formatearDinero(total)}
            {unidades > 0 && <span className="toma__badge">{unidades}</span>}
          </Boton>
        ) : (
          <Boton flujo bloque onClick={() => navegar('/')}>
            <Send size={20} strokeWidth={2.5} />
            {unidades > 0 ? 'Enviar pedido' : 'Volver al piso'}
            {unidades > 0 && <span className="toma__badge">{unidades}</span>}
          </Boton>
        )}
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
