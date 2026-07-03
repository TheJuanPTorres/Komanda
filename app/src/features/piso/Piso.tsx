// Piso: las 4 mesas y los pedidos de barra abiertos, en tiempo real.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PedidoConItems } from '@pos/shared';
import { useStore } from '../../estado/store.js';
import { pesos } from '../../lib/dinero.js';
import { contarUnidades, turnoBarra } from '../../lib/etiquetas.js';
import { ErrorApi } from '../../lib/api.js';
import { Boton, Campo, Insignia, Tarjeta } from '../../design-system/primitivas/index.js';
import './piso.css';

const MESAS = [1, 2, 3, 4];

export function Piso() {
  const navegar = useNavigate();
  const sesion = useStore((s) => s.sesion);
  const pedidos = useStore((s) => s.pedidos);
  const cargarMenu = useStore((s) => s.cargarMenu);
  const cargarPedidos = useStore((s) => s.cargarPedidos);
  const abrirMesa = useStore((s) => s.abrirMesa);
  const crearBarra = useStore((s) => s.crearBarra);
  const salir = useStore((s) => s.salir);

  const [ocupado, setOcupado] = useState(false);
  const [nuevoBarra, setNuevoBarra] = useState(false);
  const [cliente, setCliente] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Carga inicial; a partir de aquí todo llega por WS.
    cargarMenu().catch(() => setError('No se pudo cargar el menú.'));
    cargarPedidos().catch(() => setError('No se pudieron cargar los pedidos.'));
  }, [cargarMenu, cargarPedidos]);

  const pedidoDeMesa = (n: number): PedidoConItems | undefined =>
    pedidos.find((p) => p.pedido.tipo === 'mesa' && p.pedido.mesa_numero === n);

  const pedidosBarra = pedidos
    .filter((p) => p.pedido.tipo === 'barra')
    .sort((a, b) => (a.pedido.turno ?? 0) - (b.pedido.turno ?? 0));

  async function tocarMesa(n: number) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const p = await abrirMesa(n);
      navegar(`/pedido/${p.pedido.id}`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir la mesa.');
      setOcupado(false);
    }
  }

  async function confirmarBarra() {
    const nombre = cliente.trim();
    if (!nombre) return;
    setOcupado(true);
    setError('');
    try {
      const p = await crearBarra(nombre);
      navegar(`/pedido/${p.pedido.id}`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo crear el pedido.');
      setOcupado(false);
    }
  }

  return (
    <div className="piso">
      <header className="encabezado">
        <div className="encabezado__usuario">
          {sesion?.nombre}
          <Insignia tono={sesion?.rol === 'admin' ? 'acento' : 'neutro'}>
            {sesion?.rol === 'admin' ? 'Admin' : 'Mesero'}
          </Insignia>
        </div>
        <div className="fila" style={{ gap: 'var(--esp-2)' }}>
          {sesion?.rol === 'admin' && (
            <>
              <Boton variante="secundario" onClick={() => navegar('/gastos')}>
                Gastos
              </Boton>
              <Boton variante="secundario" onClick={() => navegar('/reportes')}>
                Reportes
              </Boton>
              <Boton variante="secundario" onClick={() => navegar('/cierre')}>
                Cierre
              </Boton>
            </>
          )}
          <Boton variante="fantasma" onClick={() => salir()}>
            Salir
          </Boton>
        </div>
      </header>

      <div className="piso__cuerpo">
        {error && <div className="acceso__error">{error}</div>}

        <section>
          <h2 className="piso__titulo">Mesas</h2>
          <div className="mesas">
            {MESAS.map((n) => {
              const p = pedidoDeMesa(n);
              return (
                <button
                  key={n}
                  className={`mesa ${p ? 'mesa--ocupada' : ''}`}
                  onClick={() => tocarMesa(n)}
                  disabled={ocupado}
                >
                  <span className="mesa__numero">{n}</span>
                  {p ? (
                    <>
                      <span className="mesa__estado">
                        {contarUnidades(p.items)} ítem(s) · ocupada
                      </span>
                      <span className="mesa__total">{pesos(p.total)}</span>
                    </>
                  ) : (
                    <span className="mesa__estado">Libre · toca para abrir</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="piso__titulo">Barra</h2>
          <div className="barra">
            {pedidosBarra.map((p) => (
              <button
                key={p.pedido.id}
                className="barra__pedido"
                onClick={() => navegar(`/pedido/${p.pedido.id}`)}
              >
                <span className="barra__turno">{turnoBarra(p.pedido.turno)}</span>
                <span className="barra__cliente">{p.pedido.cliente_nombre}</span>
                <span className="barra__meta">
                  {contarUnidades(p.items)} ítem(s) · {pesos(p.total)}
                </span>
              </button>
            ))}
            <button className="barra__nuevo" onClick={() => setNuevoBarra(true)} disabled={ocupado}>
              + Nuevo pedido de barra
            </button>
            {pedidosBarra.length === 0 && (
              <span className="piso__vacio">No hay pedidos de barra abiertos.</span>
            )}
          </div>
        </section>
      </div>

      {nuevoBarra && (
        <div className="modal__fondo" onClick={() => !ocupado && setNuevoBarra(false)}>
          <Tarjeta className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo pedido de barra</h3>
            <Campo
              etiqueta="Nombre del cliente"
              value={cliente}
              autoFocus
              maxLength={60}
              onChange={(e) => setCliente(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarBarra()}
              placeholder="Ej: Pedro"
            />
            <div className="modal__acciones">
              <Boton
                variante="secundario"
                bloque
                onClick={() => {
                  setNuevoBarra(false);
                  setCliente('');
                }}
                disabled={ocupado}
              >
                Cancelar
              </Boton>
              <Boton bloque onClick={confirmarBarra} disabled={ocupado || !cliente.trim()}>
                Crear
              </Boton>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
