// Reportes (solo admin): margen por producto y ventas por día/hora.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReporteConciliacion, ReporteMargen, ReporteVentas } from '@pos/shared';
import { api } from '../../lib/api.js';
import { pesos } from '../../lib/dinero.js';
import { hora } from '../../lib/fechas.js';
import { hoyBogota, restarDias } from '../../lib/periodos.js';
import { Cargando, Tarjeta } from '../../design-system/primitivas/index.js';
import '../comunes/pagina.css';
import './reportes.css';

type Preset = 'hoy' | '7' | '30' | 'custom';
type Pestana = 'margen' | 'ventas' | 'conciliacion';

export function Reportes() {
  const navegar = useNavigate();
  const hoy = hoyBogota();

  const [preset, setPreset] = useState<Preset>('7');
  const [desde, setDesde] = useState(restarDias(hoy, 6));
  const [hasta, setHasta] = useState(hoy);
  const [pestana, setPestana] = useState<Pestana>('margen');

  const [margen, setMargen] = useState<ReporteMargen | null>(null);
  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [conciliacion, setConciliacion] = useState<ReporteConciliacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  function aplicarPreset(p: Preset) {
    setPreset(p);
    if (p === 'hoy') {
      setDesde(hoy);
      setHasta(hoy);
    } else if (p === '7') {
      setDesde(restarDias(hoy, 6));
      setHasta(hoy);
    } else if (p === '30') {
      setDesde(restarDias(hoy, 29));
      setHasta(hoy);
    }
  }

  useEffect(() => {
    if (desde > hasta) return;
    setCargando(true);
    setError('');
    const q = `desde=${desde}&hasta=${hasta}`;
    Promise.all([
      api.get<{ reporte: ReporteMargen }>(`/api/reportes/margen?${q}`),
      api.get<{ reporte: ReporteVentas }>(`/api/reportes/ventas?${q}`),
      api.get<{ reporte: ReporteConciliacion }>(`/api/reportes/conciliacion?${q}`)
    ])
      .then(([m, v, c]) => {
        setMargen(m.reporte);
        setVentas(v.reporte);
        setConciliacion(c.reporte);
      })
      .catch(() => setError('No se pudieron cargar los reportes.'))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  const maxDia = useMemo(
    () => Math.max(1, ...(ventas?.por_dia.map((d) => d.total) ?? [0])),
    [ventas]
  );
  const maxHora = useMemo(
    () => Math.max(1, ...(ventas?.por_hora.map((h) => h.total) ?? [0])),
    [ventas]
  );

  return (
    <div className="pagina">
      <header className="pagina__enc">
        <button className="pagina__volver" onClick={() => navegar('/')} aria-label="Volver">
          ‹
        </button>
        <div className="pagina__titulo">
          <strong>Reportes</strong>
          <span>Margen y ventas</span>
        </div>
      </header>

      <div className="pagina__cuerpo">
        <div className="rep-periodo">
          <div className="rep-presets">
            {(
              [
                ['hoy', 'Hoy'],
                ['7', '7 días'],
                ['30', '30 días']
              ] as [Preset, string][]
            ).map(([p, etiqueta]) => (
              <button
                key={p}
                className={`rep-preset ${preset === p ? 'rep-preset--activo' : ''}`}
                onClick={() => aplicarPreset(p)}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <div className="rep-fechas">
            <input
              type="date"
              className="rep-fecha"
              value={desde}
              max={hasta}
              onChange={(e) => {
                setDesde(e.target.value);
                setPreset('custom');
              }}
            />
            <input
              type="date"
              className="rep-fecha"
              value={hasta}
              min={desde}
              max={hoy}
              onChange={(e) => {
                setHasta(e.target.value);
                setPreset('custom');
              }}
            />
          </div>
        </div>

        <div className="rep-tabs">
          <button
            className={`rep-tab ${pestana === 'margen' ? 'rep-tab--activa' : ''}`}
            onClick={() => setPestana('margen')}
          >
            Margen por producto
          </button>
          <button
            className={`rep-tab ${pestana === 'ventas' ? 'rep-tab--activa' : ''}`}
            onClick={() => setPestana('ventas')}
          >
            Ventas
          </button>
          <button
            className={`rep-tab ${pestana === 'conciliacion' ? 'rep-tab--activa' : ''}`}
            onClick={() => setPestana('conciliacion')}
          >
            Conciliación
          </button>
        </div>

        {error && <div className="acceso__error">{error}</div>}

        {cargando ? (
          <Cargando />
        ) : pestana === 'margen' ? (
          <TablaMargen margen={margen} />
        ) : pestana === 'ventas' ? (
          <SeccionVentas ventas={ventas} maxDia={maxDia} maxHora={maxHora} />
        ) : (
          <SeccionConciliacion conciliacion={conciliacion} />
        )}
      </div>
    </div>
  );
}

function TablaMargen({ margen }: { margen: ReporteMargen | null }) {
  if (!margen || margen.productos.length === 0) {
    return <div className="rep-vacio">No hubo ventas en este periodo.</div>;
  }
  const t = margen.totales;
  return (
    <Tarjeta className="rep-tabla-cont">
      <table className="rep-tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Unid.</th>
            <th>Ingresos</th>
            <th>Costo</th>
            <th>Margen</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {margen.productos.map((p) => (
            <tr key={p.producto_id}>
              <td className="rep-tabla__nombre">{p.nombre}</td>
              <td>{p.unidades}</td>
              <td>{pesos(p.ingresos)}</td>
              <td>{pesos(p.costo)}</td>
              <td className="rep-tabla__margen">{pesos(p.margen)}</td>
              <td>{p.margen_pct}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{t.unidades}</td>
            <td>{pesos(t.ingresos)}</td>
            <td>{pesos(t.costo)}</td>
            <td>{pesos(t.margen)}</td>
            <td>{t.margen_pct}%</td>
          </tr>
        </tfoot>
      </table>
    </Tarjeta>
  );
}

function SeccionVentas({
  ventas,
  maxDia,
  maxHora
}: {
  ventas: ReporteVentas | null;
  maxDia: number;
  maxHora: number;
}) {
  if (!ventas || ventas.totales.num_pedidos === 0) {
    return <div className="rep-vacio">No hubo ventas en este periodo.</div>;
  }
  const t = ventas.totales;
  const horaPico = ventas.por_hora.reduce((mx, h) => (h.total > mx.total ? h : mx), ventas.por_hora[0]!);

  return (
    <>
      <div className="rep-totales">
        <Tarjeta className="rep-total">
          <span>Total vendido</span>
          <strong>{pesos(t.total)}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>Efectivo</span>
          <strong>{pesos(t.efectivo)}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>QR Bre-B</span>
          <strong>{pesos(t.qr)}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>Pedidos</span>
          <strong>{t.num_pedidos}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>Ticket promedio</span>
          <strong>{pesos(t.ticket_promedio)}</strong>
        </Tarjeta>
      </div>

      <section className="rep-seccion">
        <h2 className="pagina__seccion-titulo">Ventas por día</h2>
        <div className="rep-dias">
          {ventas.por_dia.map((d) => (
            <div className="rep-dia" key={d.fecha}>
              <span className="rep-dia__fecha">{d.fecha}</span>
              <div className="rep-dia__barra-fondo">
                <div className="rep-dia__barra" style={{ width: `${(d.total / maxDia) * 100}%` }} />
              </div>
              <span className="rep-dia__valor">{pesos(d.total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rep-seccion">
        <h2 className="pagina__seccion-titulo">
          Ventas por hora {horaPico.total > 0 && `· pico ${horaPico.hora}:00`}
        </h2>
        <div className="rep-horas">
          {ventas.por_hora.map((h) => (
            <div className="rep-hora" key={h.hora} title={`${h.hora}:00 · ${pesos(h.total)}`}>
              <div
                className={`rep-hora__barra ${h.hora === horaPico.hora && h.total > 0 ? 'rep-hora__barra--pico' : ''}`}
                style={{ height: `${(h.total / maxHora) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="rep-horas-ejes">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>23h</span>
        </div>
      </section>
    </>
  );
}

function SeccionConciliacion({ conciliacion }: { conciliacion: ReporteConciliacion | null }) {
  if (!conciliacion) return <div className="rep-vacio">Sin datos.</div>;
  const { resumen, sin_pago, pagos_sin_conciliar } = conciliacion;
  const todoCuadra =
    resumen.pagos_qr > 0 && sin_pago.length === 0 && pagos_sin_conciliar.length === 0;

  return (
    <>
      <div className="rep-totales">
        <Tarjeta className="rep-total">
          <span>Pagos QR</span>
          <strong>{resumen.pagos_qr}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>Con correo del banco</span>
          <strong>{resumen.conciliados}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>QR sin correo</span>
          <strong>{resumen.pagos_sin_correo}</strong>
        </Tarjeta>
        <Tarjeta className="rep-total">
          <span>Correos sin pago</span>
          <strong>{resumen.correos_sin_pago}</strong>
        </Tarjeta>
      </div>

      <p className="rep-nota">
        La conciliación la alimenta el lector de correos (proceso aparte). Si no está configurado,
        estas listas mostrarán todos los pagos QR como "sin correo".
      </p>

      {todoCuadra && <div className="cierre-banner">Todo cuadra: cada pago QR tiene su correo.</div>}

      {pagos_sin_conciliar.length > 0 && (
        <section className="rep-seccion">
          <h2 className="pagina__seccion-titulo">Pagos QR sin correo del banco</h2>
          <Tarjeta className="rep-tabla-cont">
            <table className="rep-tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {pagos_sin_conciliar.map((p) => (
                  <tr key={p.pago_id}>
                    <td className="rep-tabla__nombre">#{p.pedido_id}</td>
                    <td>{pesos(p.monto)}</td>
                    <td>{p.referencia_externa ?? '—'}</td>
                    <td>{hora(p.creado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </section>
      )}

      {sin_pago.length > 0 && (
        <section className="rep-seccion">
          <h2 className="pagina__seccion-titulo">Correos del banco sin pago registrado</h2>
          <Tarjeta className="rep-tabla-cont">
            <table className="rep-tabla">
              <thead>
                <tr>
                  <th>Asunto</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {sin_pago.map((n) => (
                  <tr key={n.id}>
                    <td className="rep-tabla__nombre">{n.asunto || n.remitente || '—'}</td>
                    <td>{n.monto !== null ? pesos(n.monto) : '—'}</td>
                    <td>{n.referencia ?? '—'}</td>
                    <td>{hora(n.creado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </section>
      )}

      {resumen.pagos_qr === 0 && sin_pago.length === 0 && (
        <div className="rep-vacio">No hubo pagos QR ni correos en este periodo.</div>
      )}
    </>
  );
}
