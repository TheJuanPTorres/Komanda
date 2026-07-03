// Gastos del día (solo admin). Registrar salidas de dinero y verlas listadas.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CategoriaGasto, Gasto, MetodoPago } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { pesos } from '../../lib/dinero.js';
import { hora } from '../../lib/fechas.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { ETIQUETA_CATEGORIA_GASTO, etiquetaMetodo } from '../../lib/etiquetas.js';
import { Boton, Campo, Cargando, Insignia, Tarjeta } from '../../design-system/primitivas/index.js';
import '../comunes/pagina.css';
import './gastos.css';

const CATEGORIAS: CategoriaGasto[] = ['insumos', 'servicios', 'nomina', 'otros'];

export function Gastos() {
  const navegar = useNavigate();
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('insumos');
  const [monto, setMonto] = useState(0);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ gastos: Gasto[] }>('/api/gastos')
      .then((r) => setGastos(r.gastos))
      .catch(() => setGastos([]));
  }, []);

  const totalEfectivo = (gastos ?? [])
    .filter((g) => g.metodo === 'efectivo')
    .reduce((a, g) => a + g.monto, 0);
  const totalQr = (gastos ?? [])
    .filter((g) => g.metodo === 'qr_breb')
    .reduce((a, g) => a + g.monto, 0);

  async function registrar() {
    if (!concepto.trim() || monto <= 0) return;
    setOcupado(true);
    setError('');
    try {
      const { gasto } = await api.post<{ gasto: Gasto }>('/api/gastos', {
        concepto: concepto.trim(),
        categoria,
        monto,
        metodo,
        nota: nota.trim() || undefined
      });
      setGastos((prev) => [gasto, ...(prev ?? [])]);
      setConcepto('');
      setMonto(0);
      setNota('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo registrar el gasto.');
    } finally {
      setOcupado(false);
    }
  }

  if (gastos === null) return <Cargando pantalla />;

  return (
    <div className="pagina">
      <header className="pagina__enc">
        <button className="pagina__volver" onClick={() => navegar('/')} aria-label="Volver">
          ‹
        </button>
        <div className="pagina__titulo">
          <strong>Gastos de hoy</strong>
          <span>Salidas de dinero del día</span>
        </div>
      </header>

      <div className="pagina__cuerpo">
        {error && <div className="acceso__error">{error}</div>}

        <Tarjeta className="gasto-form">
          <Campo
            etiqueta="Concepto"
            value={concepto}
            maxLength={80}
            placeholder="Ej: Carne y pan"
            onChange={(e) => setConcepto(e.target.value)}
          />
          <div className="gasto-form__fila">
            <label className="ds-campo">
              <span className="ds-campo__etiqueta">Categoría</span>
              <select
                className="campo-select"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {ETIQUETA_CATEGORIA_GASTO[c]}
                  </option>
                ))}
              </select>
            </label>
            <Campo
              etiqueta="Monto"
              inputMode="numeric"
              value={monto === 0 ? '' : String(monto)}
              placeholder="0"
              onChange={(e) => setMonto(aEnteroDesdeTexto(e.target.value))}
            />
          </div>

          <div className="ds-campo">
            <span className="ds-campo__etiqueta">Método</span>
            <div className="segmentado">
              {(['efectivo', 'qr_breb'] as MetodoPago[]).map((m) => (
                <button
                  key={m}
                  className={`segmentado__op ${metodo === m ? 'segmentado__op--activo' : ''}`}
                  onClick={() => setMetodo(m)}
                >
                  {etiquetaMetodo(m)}
                </button>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Nota (opcional)"
            value={nota}
            maxLength={200}
            onChange={(e) => setNota(e.target.value)}
          />

          <Boton bloque grande disabled={ocupado || !concepto.trim() || monto <= 0} onClick={registrar}>
            Registrar gasto
          </Boton>
        </Tarjeta>

        <section>
          <h2 className="pagina__seccion-titulo">Registrados hoy</h2>
          <div className="gasto-lista">
            {gastos.length === 0 ? (
              <div className="gasto-vacio">Aún no hay gastos hoy.</div>
            ) : (
              gastos.map((g) => (
                <div className="gasto" key={g.id}>
                  <div className="gasto__info">
                    <div className="gasto__concepto">{g.concepto}</div>
                    <div className="gasto__meta">
                      <Insignia>{ETIQUETA_CATEGORIA_GASTO[g.categoria]}</Insignia>
                      <span>{etiquetaMetodo(g.metodo)}</span>
                      <span>· {hora(g.creado_en)}</span>
                      {g.nota && <span>· {g.nota}</span>}
                    </div>
                  </div>
                  <div className="gasto__monto">{pesos(g.monto)}</div>
                </div>
              ))
            )}
          </div>
          {gastos.length > 0 && (
            <div className="gasto-total">
              <span>Total del día</span>
              <strong>
                {pesos(totalEfectivo)} efectivo
                {totalQr > 0 && ` · ${pesos(totalQr)} QR`}
              </strong>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
