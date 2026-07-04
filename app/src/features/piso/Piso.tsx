// Piso: las 4 mesas y los pedidos de barra abiertos, en tiempo real.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { PedidoConItems } from '@pos/shared';
import { useStore } from '../../estado/store.js';
import { turnoBarra } from '../../lib/etiquetas.js';
import { ErrorApi } from '../../lib/api.js';
import { Boton, Campo, Modal, TarjetaMesa } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
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

  const acciones = (
    <>
      {sesion?.rol === 'admin' && (
        <>
          <Boton variante="secundario" onClick={() => navegar('/productos')}>
            Productos
          </Boton>
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
    </>
  );

  return (
    <div className="piso">
      <Encabezado
        titulo={sesion?.nombre ?? ''}
        subtitulo={sesion?.rol === 'admin' ? 'Administrador' : 'Auxiliar'}
        acciones={acciones}
      />

      <div className="piso__cuerpo">
        {error && <div className="aviso-error">{error}</div>}

        <section>
          <h2 className="seccion-titulo">Mesas</h2>
          <div className="piso__mesas">
            {MESAS.map((n) => {
              const p = pedidoDeMesa(n);
              return (
                <TarjetaMesa
                  key={n}
                  numero={n}
                  estado={p ? 'ocupada' : 'libre'}
                  total={p?.total}
                  onClick={() => tocarMesa(n)}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="seccion-titulo">Barra</h2>
          <div className="piso__barra">
            {pedidosBarra.map((p) => (
              <TarjetaMesa
                key={p.pedido.id}
                variante="barra"
                turno={turnoBarra(p.pedido.turno)}
                cliente={p.pedido.cliente_nombre ?? ''}
                estado="ocupada"
                total={p.total}
                onClick={() => navegar(`/pedido/${p.pedido.id}`)}
              />
            ))}
            <button className="piso__nuevo" onClick={() => setNuevoBarra(true)} disabled={ocupado}>
              <Plus size={24} strokeWidth={2.25} />
              Nuevo de barra
            </button>
          </div>
          {pedidosBarra.length === 0 && (
            <p className="vacio">
              <strong>Nada en la barra.</strong>
              Toca “Nuevo de barra” para el primer turno.
            </p>
          )}
        </section>
      </div>

      {nuevoBarra && (
        <Modal titulo="Nuevo pedido de barra" onCerrar={() => !ocupado && setNuevoBarra(false)}>
          <Campo
            etiqueta="Nombre del cliente"
            value={cliente}
            autoFocus
            maxLength={60}
            onChange={(e) => setCliente(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmarBarra()}
            placeholder="Ej: Pedro"
          />
          <div className="ds-modal__acciones">
            <Boton
              variante="secundario"
              bloque
              disabled={ocupado}
              onClick={() => {
                setNuevoBarra(false);
                setCliente('');
              }}
            >
              Cancelar
            </Boton>
            <Boton bloque disabled={ocupado || !cliente.trim()} onClick={confirmarBarra}>
              Crear
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
