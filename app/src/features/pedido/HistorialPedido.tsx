// Sección plegable "Historial" en el detalle de un pedido abierto: consume la
// bitácora y muestra una línea de tiempo simple (hora + descripción). Las
// correcciones (bajar/quitar) se resaltan con el amarillo de la marca.
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EventoPedido } from '@pos/shared';
import { api } from '../../lib/api.js';
import { hora } from '../../lib/fechas.js';
import { describirEvento, esCorreccion } from '../../lib/eventos.js';
import { Skeleton } from '../../design-system/index.js';

interface Props {
  pedidoId: number;
  // Cambia con cada mutación del pedido; refresca el historial si está abierto.
  revision: number;
}

export function HistorialPedido({ pedidoId, revision }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<EventoPedido[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    api
      .get<{ eventos: EventoPedido[] }>(`/api/pedidos/${pedidoId}/eventos`)
      .then((r) => vivo && setEventos(r.eventos))
      .catch(() => vivo && setError('No se pudo cargar el historial.'));
    return () => {
      vivo = false;
    };
  }, [abierto, revision, pedidoId]);

  return (
    <div className="hist">
      <button
        className="hist__toggle"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
      >
        <span>Historial</span>
        <ChevronDown
          size={20}
          strokeWidth={2.25}
          className={`hist__chevron ${abierto ? 'hist__chevron--abierto' : ''}`}
        />
      </button>

      {abierto && (
        <div className="hist__lista">
          {error && <div className="aviso-error">{error}</div>}
          {eventos === null ? (
            <>
              <Skeleton alto={14} />
              <Skeleton ancho="70%" alto={14} />
            </>
          ) : eventos.length === 0 ? (
            <p className="hist__vacio">Sin movimientos todavía.</p>
          ) : (
            eventos.map((e) => (
              <div
                key={e.id}
                className={`hist__ev ${esCorreccion(e.tipo) ? 'hist__ev--correccion' : ''}`}
              >
                <span className="hist__hora">{hora(e.creado_en)}</span>
                <span className="hist__desc">{describirEvento(e)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
