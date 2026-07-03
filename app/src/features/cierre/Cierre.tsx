// Cierre de caja del día (solo admin). Muestra las ventas y gastos del día,
// permite escribir la base y el efectivo contado, y calcula la diferencia.
// Uno por día: si ya se cerró, se muestra en solo lectura.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CierreCaja, CierrePreview } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { pesos } from '../../lib/dinero.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { Boton, Campo, Cargando, Tarjeta } from '../../design-system/primitivas/index.js';
import '../comunes/pagina.css';
import './cierre.css';

// Fila etiqueta/valor. `tono` colorea el valor (resta en rojo, suma en verde).
function Linea({
  etiqueta,
  valor,
  fuerte,
  tono
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  tono?: 'resta' | 'suma';
}) {
  return (
    <div className={`cierre-linea ${fuerte ? 'cierre-linea--fuerte' : ''}`}>
      <span className="cierre-linea__etiqueta">{etiqueta}</span>
      <span className={`cierre-linea__valor ${tono ? `cierre-linea__valor--${tono}` : ''}`}>
        {valor}
      </span>
    </div>
  );
}

// Resumen de un cierre ya registrado (solo lectura).
function ResumenCierre({ c }: { c: CierreCaja }) {
  const claseDif =
    c.diferencia === 0 ? 'cierre-dif--cuadra' : c.diferencia < 0 ? 'cierre-dif--falta' : 'cierre-dif--sobra';
  const textoDif = c.diferencia === 0 ? 'Cuadra' : c.diferencia < 0 ? 'Faltante' : 'Sobrante';
  return (
    <Tarjeta className="cierre-card">
      <Linea etiqueta="Base inicial" valor={pesos(c.base_inicial)} />
      <Linea etiqueta="Ventas en efectivo" valor={`+ ${pesos(c.ventas_efectivo)}`} tono="suma" />
      <Linea etiqueta="Gastos en efectivo" valor={`− ${pesos(c.gastos_efectivo)}`} tono="resta" />
      <Linea etiqueta="Efectivo esperado" valor={pesos(c.efectivo_esperado)} fuerte />
      <Linea etiqueta="Efectivo contado" valor={pesos(c.efectivo_contado)} />
      <div className={`cierre-dif ${claseDif}`}>
        <span>{textoDif}</span>
        <strong>{pesos(Math.abs(c.diferencia))}</strong>
      </div>
      <Linea etiqueta="Ventas por QR Bre-B" valor={pesos(c.ventas_qr)} />
      <Linea etiqueta="Pedidos cobrados" valor={String(c.num_pedidos)} />
      {c.nota && <Linea etiqueta="Nota" valor={c.nota} />}
    </Tarjeta>
  );
}

export function Cierre() {
  const navegar = useNavigate();
  const [preview, setPreview] = useState<CierrePreview | null>(null);
  const [base, setBase] = useState(0);
  const [contado, setContado] = useState(0);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<CierreCaja | null>(null);

  useEffect(() => {
    api
      .get<{ preview: CierrePreview }>('/api/cierre-caja/hoy')
      .then((r) => {
        setPreview(r.preview);
        setBase(r.preview.base_inicial_sugerida);
      })
      .catch(() => setError('No se pudo cargar el cierre.'));
  }, []);

  if (!preview) return <Cargando pantalla />;

  const yaCerrado = hecho ?? preview.cierre;
  const esperado = base + preview.ventas_efectivo - preview.gastos_efectivo;
  const diferencia = contado - esperado;
  const claseDif =
    diferencia === 0 ? 'cierre-dif--cuadra' : diferencia < 0 ? 'cierre-dif--falta' : 'cierre-dif--sobra';
  const textoDif = diferencia === 0 ? 'Cuadra' : diferencia < 0 ? 'Faltante' : 'Sobrante';

  async function cerrar() {
    setOcupado(true);
    setError('');
    try {
      const { cierre } = await api.post<{ cierre: CierreCaja }>('/api/cierre-caja', {
        base_inicial: base,
        efectivo_contado: contado,
        nota: nota.trim() || undefined
      });
      setHecho(cierre);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cerrar la caja.');
      setOcupado(false);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina__enc">
        <button className="pagina__volver" onClick={() => navegar('/')} aria-label="Volver">
          ‹
        </button>
        <div className="pagina__titulo">
          <strong>Cierre de caja</strong>
          <span>{preview.fecha}</span>
        </div>
      </header>

      <div className="pagina__cuerpo">
        {error && <div className="acceso__error">{error}</div>}

        {yaCerrado ? (
          <>
            <div className="cierre-banner">La caja de hoy ya fue cerrada.</div>
            <ResumenCierre c={yaCerrado} />
            <Boton bloque grande onClick={() => navegar('/')}>
              Volver al piso
            </Boton>
          </>
        ) : (
          <>
            {preview.pedidos_abiertos > 0 && (
              <div className="cierre-aviso">
                Hay {preview.pedidos_abiertos} pedido(s) abierto(s). Sus pagos aún no entran en este
                cierre.
              </div>
            )}

            <Tarjeta className="cierre-card">
              <div className="cierre-linea">
                <span className="cierre-linea__etiqueta">Base inicial</span>
                <input
                  className="cierre-input"
                  inputMode="numeric"
                  value={base === 0 ? '' : String(base)}
                  placeholder="0"
                  onChange={(e) => setBase(aEnteroDesdeTexto(e.target.value))}
                />
              </div>
              <Linea etiqueta="Ventas en efectivo" valor={`+ ${pesos(preview.ventas_efectivo)}`} tono="suma" />
              <Linea etiqueta="Gastos en efectivo" valor={`− ${pesos(preview.gastos_efectivo)}`} tono="resta" />
              <Linea etiqueta="Efectivo esperado" valor={pesos(esperado)} fuerte />
              <div className="cierre-linea">
                <span className="cierre-linea__etiqueta">Efectivo contado</span>
                <input
                  className="cierre-input"
                  inputMode="numeric"
                  autoFocus
                  value={contado === 0 ? '' : String(contado)}
                  placeholder="0"
                  onChange={(e) => setContado(aEnteroDesdeTexto(e.target.value))}
                />
              </div>

              <div className={`cierre-dif ${claseDif}`}>
                <span>{textoDif}</span>
                <strong>{pesos(Math.abs(diferencia))}</strong>
              </div>

              <Linea etiqueta="Ventas por QR Bre-B" valor={pesos(preview.ventas_qr)} />
              <Linea etiqueta="Pedidos cobrados hoy" valor={String(preview.num_pedidos)} />
            </Tarjeta>

            <Campo
              etiqueta="Nota (opcional)"
              value={nota}
              maxLength={200}
              placeholder="Ej: sobró vuelto de un pago"
              onChange={(e) => setNota(e.target.value)}
            />

            <Boton bloque grande disabled={ocupado} onClick={cerrar}>
              Cerrar caja
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}
