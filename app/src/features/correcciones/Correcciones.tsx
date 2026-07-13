// Sección CORRECCIONES (admin): tarjetas de solicitudes pendientes con
// APROBAR / RECHAZAR de un toque. Se alimenta del store (WS en vivo): si llega
// una nueva mientras está abierta, aparece sin recargar.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { SolicitudCorreccion } from '@pos/shared';
import { ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { refBarra } from '../../lib/etiquetas.js';
import { Boton, Modal } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import './correcciones.css';

// "hace cuánto" a partir de la marca UTC de SQLite ('YYYY-MM-DD HH:MM:SS').
function hace(creadoEn: string): string {
  const ms = Date.now() - new Date(creadoEn.replace(' ', 'T') + 'Z').getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

function refPedido(s: SolicitudCorreccion): string {
  return s.pedido_tipo === 'mesa' ? `Mesa ${s.mesa_numero}` : refBarra(s.turno, s.cliente_nombre);
}

export function Correcciones() {
  const navegar = useNavigate();
  const solicitudes = useStore((s) => s.correcciones);
  const aprobarCorreccion = useStore((s) => s.aprobarCorreccion);
  const rechazarCorreccion = useStore((s) => s.rechazarCorreccion);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState<number | null>(null);
  // Confirmación solo para aprobar eliminaciones.
  const [porAprobar, setPorAprobar] = useState<SolicitudCorreccion | null>(null);

  async function resolver(accion: () => Promise<void>, id: number) {
    setOcupada(id);
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo resolver.');
    } finally {
      setOcupada(null);
    }
  }

  function aprobar(s: SolicitudCorreccion) {
    if (s.tipo === 'eliminar') setPorAprobar(s);
    else resolver(() => aprobarCorreccion(s.id), s.id);
  }

  return (
    <div className="pagina">
      <Encabezado
        titulo="Correcciones"
        subtitulo="Solicitudes pendientes de aprobación"
        onVolver={() => navegar('/')}
        acciones={<NavAdmin />}
      />

      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}

        {solicitudes.length === 0 ? (
          <p className="vacio">
            <strong>Todo al día.</strong>
            No hay correcciones pendientes.
          </p>
        ) : (
          <div className="corr-lista">
            {solicitudes.map((s) => (
              <div className="corr" key={s.id}>
                <div className="corr__cab">
                  <span className="corr__ref">{refPedido(s)}</span>
                  <span className="corr__hace">{hace(s.creado_en)}</span>
                </div>
                <div className="corr__cuerpo">
                  <div className="corr__accion">
                    {s.tipo === 'reducir'
                      ? `Bajar a ${s.cantidad_nueva}`
                      : 'Eliminar'}
                  </div>
                  <div className="corr__prod">
                    {s.cantidad_actual}× {s.nombre}
                  </div>
                  <div className="corr__quien">Lo pide: {s.solicitado_por_nombre}</div>
                  {s.motivo && <div className="corr__motivo">“{s.motivo}”</div>}
                </div>
                <div className="corr__acciones">
                  <Boton
                    variante="peligro"
                    bloque
                    disabled={ocupada === s.id}
                    onClick={() => resolver(() => rechazarCorreccion(s.id), s.id)}
                  >
                    <X size={20} strokeWidth={2.25} />
                    Rechazar
                  </Boton>
                  <Boton flujo bloque disabled={ocupada === s.id} onClick={() => aprobar(s)}>
                    <Check size={20} strokeWidth={2.25} />
                    Aprobar
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {porAprobar && (
        <Modal titulo="¿Aprobar eliminación?" onCerrar={() => setPorAprobar(null)}>
          <p className="ds-modal__consecuencia">
            Se eliminará “{porAprobar.nombre}” del pedido y se devolverá su inventario. Si es lo
            último, el pedido se cancela.
          </p>
          <div className="ds-modal__acciones">
            <Boton variante="secundario" bloque onClick={() => setPorAprobar(null)}>
              Volver
            </Boton>
            <Boton
              flujo
              bloque
              onClick={() => {
                const s = porAprobar;
                setPorAprobar(null);
                resolver(() => aprobarCorreccion(s.id), s.id);
              }}
            >
              Sí, eliminar
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
