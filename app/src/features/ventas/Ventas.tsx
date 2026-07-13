// Explorador de ventas (admin). Listado compacto con barra de filtros
// (atajos de fecha + método/tipo/estado/correcciones), franja de agregados
// siempre visible y scroll infinito por cursor. Solo lectura.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, Download, QrCode } from 'lucide-react';
import type {
  AgregadosVentas,
  FiltroVentas,
  MetodoPago,
  RespVentas,
  Usuario,
  VentaResumen
} from '@pos/shared';
import { api } from '../../lib/api.js';
import { formatearDinero } from '../../design-system/index.js';
import { refBarra } from '../../lib/etiquetas.js';
import { fechaHora } from '../../lib/fechas.js';
import { hoyBogota, restarDias } from '../../lib/periodos.js';
import { Boton, Chip } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import './ventas.css';

type AtajoFecha = 'hoy' | 'ayer' | 'semana' | 'todo';

// Traduce un atajo de fecha a {desde, hasta} en días de Bogotá.
function rangoDe(atajo: AtajoFecha): { desde?: string; hasta?: string } {
  const hoy = hoyBogota();
  if (atajo === 'hoy') return { desde: hoy, hasta: hoy };
  if (atajo === 'ayer') return { desde: restarDias(hoy, 1), hasta: restarDias(hoy, 1) };
  if (atajo === 'semana') return { desde: restarDias(hoy, 6), hasta: hoy };
  return {};
}

function referencia(v: VentaResumen): string {
  return v.tipo === 'mesa' ? `Mesa ${v.mesa_numero}` : refBarra(v.turno, v.cliente_nombre);
}

function IconoMetodo({ metodo }: { metodo: MetodoPago }) {
  return metodo === 'efectivo' ? (
    <Banknote size={16} strokeWidth={2.25} aria-label="Efectivo" />
  ) : (
    <QrCode size={16} strokeWidth={2.25} aria-label="QR Bre-B" />
  );
}

function queryDe(f: FiltroVentas): string {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(f)) {
    if (val !== undefined && val !== '' && val !== false) p.set(k, String(val));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function Ventas() {
  const navegar = useNavigate();
  const [atajo, setAtajo] = useState<AtajoFecha>('hoy');
  const [estado, setEstado] = useState<FiltroVentas['estado']>(undefined);
  const [metodo, setMetodo] = useState<MetodoPago | undefined>(undefined);
  const [tipo, setTipo] = useState<FiltroVentas['tipo']>(undefined);
  const [auxiliarId, setAuxiliarId] = useState<number | undefined>(undefined);
  const [conCorr, setConCorr] = useState(false);
  const [auxiliares, setAuxiliares] = useState<Usuario[]>([]);

  // Lista de auxiliares activos para los chips (patrón compartido con acceso).
  useEffect(() => {
    api
      .get<{ auxiliares: Usuario[] }>('/api/usuarios/auxiliares')
      .then((r) => setAuxiliares(r.auxiliares))
      .catch(() => {});
  }, []);

  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [agregados, setAgregados] = useState<AgregadosVentas>({ numero: 0, total: 0, ticket_promedio: 0 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Filtro base (sin cursor) que dispara una recarga desde cero al cambiar.
  const filtroBase = useMemo<FiltroVentas>(() => {
    return {
      ...rangoDe(atajo),
      estado,
      metodo,
      tipo,
      auxiliar_id: auxiliarId,
      con_correcciones: conCorr || undefined
    };
  }, [atajo, estado, metodo, tipo, auxiliarId, conCorr]);

  const claveFiltro = JSON.stringify(filtroBase);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError('');
    api
      .get<RespVentas>(`/api/ventas${queryDe(filtroBase)}`)
      .then((r) => {
        if (!vivo) return;
        setVentas(r.ventas);
        setAgregados(r.agregados);
        setCursor(r.cursor);
      })
      .catch(() => vivo && setError('No se pudieron cargar las ventas.'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveFiltro]);

  const cargarMas = useCallback(() => {
    if (!cursor || cargando) return;
    setCargando(true);
    api
      .get<RespVentas>(`/api/ventas${queryDe({ ...filtroBase, cursor })}`)
      .then((r) => {
        setVentas((prev) => [...prev, ...r.ventas]);
        setCursor(r.cursor);
      })
      .catch(() => setError('No se pudieron cargar más ventas.'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, cargando, claveFiltro]);

  // Descarga el CSV del filtro activo (el endpoint fuerza la descarga con BOM).
  function descargarCsv() {
    const a = document.createElement('a');
    a.href = `/api/ventas.csv${queryDe(filtroBase)}`;
    a.download = 'ventas.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Scroll infinito: al ver el centinela, se pide la página siguiente.
  const centinela = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = centinela.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => e[0]?.isIntersecting && cargarMas());
    obs.observe(el);
    return () => obs.disconnect();
  }, [cargarMas]);

  return (
    <div className="pagina">
      <Encabezado
        titulo="Ventas"
        subtitulo="Explorador de pedidos cobrados y cancelados"
        onVolver={() => navegar('/')}
        acciones={<NavAdmin />}
      />

      <div className="pagina__cuerpo pagina__cuerpo--ancho">
        {/* Barra de filtros */}
        <div className="vf">
          <div className="vf__fila">
            <Chip activo={atajo === 'hoy'} onClick={() => setAtajo('hoy')}>Hoy</Chip>
            <Chip activo={atajo === 'ayer'} onClick={() => setAtajo('ayer')}>Ayer</Chip>
            <Chip activo={atajo === 'semana'} onClick={() => setAtajo('semana')}>7 días</Chip>
            <Chip activo={atajo === 'todo'} onClick={() => setAtajo('todo')}>Todo</Chip>
          </div>
          <div className="vf__fila">
            <Chip activo={!estado} onClick={() => setEstado(undefined)}>Todas</Chip>
            <Chip activo={estado === 'cobrado'} onClick={() => setEstado('cobrado')}>Cobradas</Chip>
            <Chip activo={estado === 'cancelado'} onClick={() => setEstado('cancelado')}>Canceladas</Chip>
            <span className="vf__sep" />
            <Chip activo={!metodo} onClick={() => setMetodo(undefined)}>Todo pago</Chip>
            <Chip activo={metodo === 'efectivo'} onClick={() => setMetodo('efectivo')}>Efectivo</Chip>
            <Chip activo={metodo === 'qr_breb'} onClick={() => setMetodo('qr_breb')}>QR</Chip>
            <span className="vf__sep" />
            <Chip activo={!tipo} onClick={() => setTipo(undefined)}>Mesa y barra</Chip>
            <Chip activo={tipo === 'mesa'} onClick={() => setTipo('mesa')}>Mesa</Chip>
            <Chip activo={tipo === 'barra'} onClick={() => setTipo('barra')}>Barra</Chip>
            <span className="vf__sep" />
            <Chip activo={conCorr} onClick={() => setConCorr((v) => !v)}>Con correcciones</Chip>
          </div>
          {auxiliares.length > 0 && (
            <div className="vf__fila">
              <Chip activo={!auxiliarId} onClick={() => setAuxiliarId(undefined)}>Todos</Chip>
              {auxiliares.map((a) => (
                <Chip key={a.id} activo={auxiliarId === a.id} onClick={() => setAuxiliarId(a.id)}>
                  {a.nombre}
                </Chip>
              ))}
            </div>
          )}
          <div className="vf__fila">
            <Boton variante="secundario" onClick={descargarCsv} disabled={ventas.length === 0}>
              <Download size={16} strokeWidth={2.25} />
              Exportar CSV
            </Boton>
          </div>
        </div>

        {/* Franja de agregados (siempre visible) */}
        <div className="vagg">
          <div className="vagg__celda">
            <span className="vagg__etq">Ventas</span>
            <span className="vagg__num">{agregados.numero}</span>
          </div>
          <div className="vagg__celda">
            <span className="vagg__etq">Total</span>
            <span className="vagg__num">{formatearDinero(agregados.total)}</span>
          </div>
          <div className="vagg__celda">
            <span className="vagg__etq">Ticket promedio</span>
            <span className="vagg__num">{formatearDinero(agregados.ticket_promedio)}</span>
          </div>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        {ventas.length === 0 && !cargando ? (
          <p className="vacio">
            <strong>Sin ventas.</strong>
            No hay pedidos que coincidan con el filtro.
          </p>
        ) : (
          <div className="vlist">
            {ventas.map((v) => (
              <button className="vrow" key={v.id} onClick={() => navegar(`/ventas/${v.id}`)}>
                <span className="vrow__fecha">{fechaHora(v.cerrado_en ?? v.creado_en)}</span>
                <span className="vrow__ref">
                  {referencia(v)}
                  {v.con_correcciones && (
                    <AlertTriangle size={14} strokeWidth={2.25} className="vrow__corr" aria-label="Con correcciones" />
                  )}
                </span>
                <span className="vrow__aux">{v.auxiliar_nombre}</span>
                <span className="vrow__metodos">
                  {v.estado === 'cancelado' ? (
                    <span className="vrow__cancel">Cancelada</span>
                  ) : (
                    v.metodos.map((m) => <IconoMetodo key={m} metodo={m} />)
                  )}
                </span>
                <span className="vrow__total">{formatearDinero(v.total)}</span>
              </button>
            ))}
            <div ref={centinela} className="vlist__fin">
              {cargando ? 'Cargando…' : cursor ? '' : ventas.length > 0 ? 'Fin de la lista' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
