// Gastos del día (solo admin). Registrar salidas de dinero y verlas listadas.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CategoriaGasto, Gasto, MetodoPago } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { hora } from '../../lib/fechas.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { ETIQUETA_CATEGORIA_GASTO, etiquetaMetodo } from '../../lib/etiquetas.js';
import { Boton, Campo, Chip, Tarjeta, formatearDinero } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import { Cargando } from '../comunes/Cargando.js';
import './gastos.css';

const CATEGORIAS: CategoriaGasto[] = ['insumos', 'servicios', 'nomina', 'otros'];
const METODOS: MetodoPago[] = ['efectivo', 'qr_breb'];

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

  if (gastos === null) return <Cargando />;

  return (
    <div className="pagina">
      <Encabezado
        titulo="Gastos de hoy"
        subtitulo="Salidas de dinero del día"
        onVolver={() => navegar('/')}
        acciones={<NavAdmin />}
      />

      <div className="pagina__cuerpo pagina__cuerpo--ancho">
        {error && <div className="aviso-error">{error}</div>}

        <div className="gasto-2col">
        <Tarjeta className="gasto-form">
          <Campo
            etiqueta="Concepto"
            value={concepto}
            maxLength={80}
            placeholder="Ej: Carne y pan"
            onChange={(e) => setConcepto(e.target.value)}
          />

          <div className="gasto-grupo">
            <span className="ds-campo__etiqueta">Categoría</span>
            <div className="gasto-chips">
              {CATEGORIAS.map((c) => (
                <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
                  {ETIQUETA_CATEGORIA_GASTO[c]}
                </Chip>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Monto"
            inputMode="numeric"
            value={monto === 0 ? '' : String(monto)}
            placeholder="0"
            onChange={(e) => setMonto(aEnteroDesdeTexto(e.target.value))}
          />

          <div className="gasto-grupo">
            <span className="ds-campo__etiqueta">Método</span>
            <div className="gasto-chips">
              {METODOS.map((m) => (
                <Chip key={m} activo={metodo === m} onClick={() => setMetodo(m)}>
                  {etiquetaMetodo(m)}
                </Chip>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Nota (opcional)"
            value={nota}
            maxLength={200}
            onChange={(e) => setNota(e.target.value)}
          />

          <Boton flujo bloque disabled={ocupado || !concepto.trim() || monto <= 0} onClick={registrar}>
            Registrar gasto
          </Boton>
        </Tarjeta>

        <section className="gasto-historial">
          <h2 className="seccion-titulo">Registrados hoy</h2>
          {gastos.length === 0 ? (
            <p className="vacio">
              <strong>Caja quieta.</strong>
              Aún no hay gastos hoy.
            </p>
          ) : (
            <>
              <div className="gasto-lista">
                {gastos.map((g) => (
                  <div className="gasto" key={g.id}>
                    <div className="gasto__info">
                      <div className="gasto__concepto">{g.concepto}</div>
                      <div className="gasto__meta">
                        <span className="gasto__cat">{ETIQUETA_CATEGORIA_GASTO[g.categoria]}</span>
                        <span>{etiquetaMetodo(g.metodo)}</span>
                        <span className="dinero">· {hora(g.creado_en)}</span>
                        {g.nota && <span>· {g.nota}</span>}
                      </div>
                    </div>
                    <div className="gasto__monto">{formatearDinero(g.monto)}</div>
                  </div>
                ))}
              </div>
              <div className="gasto-total">
                <span className="gasto-total__etq">Total del día</span>
                <span className="gasto-total__val">
                  {formatearDinero(totalEfectivo)} efectivo
                  {totalQr > 0 && ` · ${formatearDinero(totalQr)} QR`}
                </span>
              </div>
            </>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
