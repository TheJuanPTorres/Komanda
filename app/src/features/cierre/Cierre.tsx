// Cierre de caja del día (solo admin). Muestra ventas y gastos del día, permite
// escribir base y efectivo contado, y calcula la diferencia. Uno por día: si ya
// se cerró, se muestra en solo lectura.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CierreCaja, CierrePreview } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { Boton, Campo, Tarjeta, formatearDinero } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { Cargando } from '../comunes/Cargando.js';
import './cierre.css';

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
      <span className="cierre-linea__etq">{etiqueta}</span>
      <span className={`cierre-linea__val ${tono ? `cierre-linea__val--${tono}` : ''}`}>{valor}</span>
    </div>
  );
}

function claseYtexto(diferencia: number): [string, string] {
  if (diferencia === 0) return ['cierre-dif--cuadra', 'Cuadra'];
  if (diferencia < 0) return ['cierre-dif--falta', 'Faltante'];
  return ['cierre-dif--sobra', 'Sobrante'];
}

function ResumenCierre({ c }: { c: CierreCaja }) {
  const [clase, texto] = claseYtexto(c.diferencia);
  return (
    <Tarjeta className="cierre-card">
      <Linea etiqueta="Base inicial" valor={formatearDinero(c.base_inicial)} />
      <Linea etiqueta="Ventas en efectivo" valor={`+ ${formatearDinero(c.ventas_efectivo)}`} tono="suma" />
      <Linea etiqueta="Gastos en efectivo" valor={`− ${formatearDinero(c.gastos_efectivo)}`} tono="resta" />
      <Linea etiqueta="Efectivo esperado" valor={formatearDinero(c.efectivo_esperado)} fuerte />
      <Linea etiqueta="Efectivo contado" valor={formatearDinero(c.efectivo_contado)} />
      <div className={`cierre-dif ${clase}`}>
        <span>{texto}</span>
        <strong>{formatearDinero(Math.abs(c.diferencia))}</strong>
      </div>
      <Linea etiqueta="Ventas por QR Bre-B" valor={formatearDinero(c.ventas_qr)} />
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

  if (!preview) return <Cargando />;

  const yaCerrado = hecho ?? preview.cierre;
  const esperado = base + preview.ventas_efectivo - preview.gastos_efectivo;
  const diferencia = contado - esperado;
  const [claseDif, textoDif] = claseYtexto(diferencia);

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
      <Encabezado titulo="Cierre de caja" subtitulo={preview.fecha} onVolver={() => navegar('/')} />

      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}

        {yaCerrado ? (
          <>
            <div className="cierre-banner">La caja de hoy ya fue cerrada.</div>
            <ResumenCierre c={yaCerrado} />
            <Boton flujo bloque onClick={() => navegar('/')}>
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
                <span className="cierre-linea__etq">Base inicial</span>
                <input
                  className="cierre-input"
                  inputMode="numeric"
                  value={base === 0 ? '' : String(base)}
                  placeholder="0"
                  onChange={(e) => setBase(aEnteroDesdeTexto(e.target.value))}
                />
              </div>
              <Linea etiqueta="Ventas en efectivo" valor={`+ ${formatearDinero(preview.ventas_efectivo)}`} tono="suma" />
              <Linea etiqueta="Gastos en efectivo" valor={`− ${formatearDinero(preview.gastos_efectivo)}`} tono="resta" />
              <Linea etiqueta="Efectivo esperado" valor={formatearDinero(esperado)} fuerte />
              <div className="cierre-linea">
                <span className="cierre-linea__etq">Efectivo contado</span>
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
                <strong>{formatearDinero(Math.abs(diferencia))}</strong>
              </div>

              <Linea etiqueta="Ventas por QR Bre-B" valor={formatearDinero(preview.ventas_qr)} />
              <Linea etiqueta="Pedidos cobrados hoy" valor={String(preview.num_pedidos)} />
            </Tarjeta>

            <Campo
              etiqueta="Nota (opcional)"
              value={nota}
              maxLength={200}
              placeholder="Ej: sobró vuelto de un pago"
              onChange={(e) => setNota(e.target.value)}
            />

            <Boton flujo bloque disabled={ocupado} onClick={cerrar}>
              Cerrar caja
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}
