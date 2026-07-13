// Ficha de una venta (admin): cabecera, items con snapshots y subtotales,
// total, pagos y la línea de tiempo COMPLETA de la bitácora (las correcciones
// se resaltan con el acento de la marca).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { VentaDetalle } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { DisplayTotal, LineaPedido, formatearDinero } from '../../design-system/index.js';
import { refBarra, etiquetaMetodo } from '../../lib/etiquetas.js';
import { fechaLarga, hora } from '../../lib/fechas.js';
import { describirEvento, esCorreccion } from '../../lib/eventos.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import './ventas.css';

export function VentaFicha() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [det, setDet] = useState<VentaDetalle | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .get<VentaDetalle>(`/api/ventas/${id}`)
      .then((d) => vivo && setDet(d))
      .catch((e) => vivo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la venta.'));
    return () => {
      vivo = false;
    };
  }, [id]);

  const v = det?.venta;
  const referencia = v
    ? v.tipo === 'mesa'
      ? `Mesa ${v.mesa_numero}`
      : refBarra(v.turno, v.cliente_nombre)
    : 'Venta';

  return (
    <div className="pagina">
      <Encabezado
        titulo={referencia}
        subtitulo={v ? `${v.estado === 'cancelado' ? 'Cancelada' : 'Cobrada'} · ${v.auxiliar_nombre}` : ''}
        onVolver={() => navegar('/ventas')}
        acciones={<NavAdmin />}
      />

      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}
        {v && det && (
          <>
            <p className="vficha__cuando">{fechaLarga(v.cerrado_en ?? v.creado_en)}</p>

            <div className="vficha__items">
              {det.items.map((it) => (
                <LineaPedido
                  key={`${it.producto_id}-${it.nombre}`}
                  cantidad={it.cantidad}
                  nombre={it.nombre}
                  subtotal={it.subtotal}
                />
              ))}
            </div>

            <DisplayTotal monto={v.total} />

            {det.pagos.length > 0 && (
              <div className="vficha__pagos">
                <h3 className="seccion-titulo">Pagos</h3>
                {det.pagos.map((p) => (
                  <div className="vficha__pago" key={p.id}>
                    <span>{etiquetaMetodo(p.metodo)}</span>
                    {p.referencia_externa && <span className="vficha__ref">{p.referencia_externa}</span>}
                    <span className="vficha__monto">{formatearDinero(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="vficha__historia">
              <h3 className="seccion-titulo">Línea de tiempo</h3>
              <div className="hist__lista">
                {det.eventos.map((e) => (
                  <div
                    key={e.id}
                    className={`hist__ev ${esCorreccion(e.tipo) ? 'hist__ev--correccion' : ''}`}
                  >
                    <span className="hist__hora">{hora(e.creado_en)}</span>
                    <span className="hist__desc">{describirEvento(e)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
