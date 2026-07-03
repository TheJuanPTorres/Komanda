// Storybook de verificación del sistema PARE Y COMA (solo en dev).
// Pinta tokens, cada primitiva en sus estados, los patrones con datos de
// ejemplo, y la tabla de contraste AA calculada en vivo.
import { useState } from 'react';
import logo from '../design-system/logo.svg';
import {
  Boton,
  Campo,
  Chip,
  DisplayTotal,
  LineaPedido,
  Modal,
  Skeleton,
  Tarjeta,
  TarjetaMesa,
  TarjetaProducto,
  TecladoPin,
  Toast
} from '../design-system/index.js';
import { razonContraste, veredictoAA } from './contraste.js';
import './muestra.css';

const SUPERFICIES: [string, string][] = [
  ['Papel (superficie-0)', '#F0E5C9'],
  ['Superficie 1', '#FBF4E4'],
  ['Superficie 2', '#FFFBEF'],
  ['Nocturna', '#15110A']
];
const TINTAS: [string, string][] = [
  ['Tinta fuerte', '#15110A'],
  ['Tinta media', '#5C5142'],
  ['Tinta suave', '#8C7F6B'],
  ['Sobre nocturno', '#F0E5C9']
];
const MARCA: [string, string][] = [
  ['PARE', '#BE2026'],
  ['PARE presionado', '#9E1A1F'],
  ['COMA', '#F5C518'],
  ['COMA tenue', '#FAE9B4'],
  ['Éxito', '#2E7D46'],
  ['Línea', '#D9CCA8']
];
const ESPACIOS: [string, number][] = [
  ['esp-1', 4],
  ['esp-2', 8],
  ['esp-3', 16],
  ['esp-4', 24],
  ['esp-5', 32],
  ['esp-6', 48]
];
const RADIOS: [string, number][] = [
  ['radio-s', 10],
  ['radio-m', 14],
  ['radio-l', 22]
];

// Combinaciones tinta/superficie realmente usadas por el sistema.
const COMBOS: { etq: string; fg: string; bg: string }[] = [
  { etq: 'Tinta fuerte / Papel', fg: '#15110A', bg: '#F0E5C9' },
  { etq: 'Tinta fuerte / Superficie 1', fg: '#15110A', bg: '#FBF4E4' },
  { etq: 'Tinta fuerte / Superficie 2', fg: '#15110A', bg: '#FFFBEF' },
  { etq: 'Tinta media / Papel', fg: '#5C5142', bg: '#F0E5C9' },
  { etq: 'Tinta media / Superficie 1', fg: '#5C5142', bg: '#FBF4E4' },
  { etq: 'Tinta suave / Papel', fg: '#8C7F6B', bg: '#F0E5C9' },
  { etq: 'Sobre nocturno / Nocturna', fg: '#F0E5C9', bg: '#15110A' },
  { etq: 'Crema / PARE (botón primario)', fg: '#F0E5C9', bg: '#BE2026' },
  { etq: 'Tinta fuerte / COMA (chip activo)', fg: '#15110A', bg: '#F5C518' },
  { etq: 'COMA / Nocturna (monto total)', fg: '#F5C518', bg: '#15110A' },
  { etq: 'PARE / Papel (texto peligro)', fg: '#BE2026', bg: '#F0E5C9' },
  { etq: 'PARE / Superficie 2 (outline)', fg: '#BE2026', bg: '#FFFBEF' },
  { etq: 'Éxito / Papel', fg: '#2E7D46', bg: '#F0E5C9' },
  { etq: 'Tinta fuerte / COMA tenue (por cobrar)', fg: '#15110A', bg: '#FAE9B4' }
];

function Swatch({ nombre, hex }: { nombre: string; hex: string }) {
  return (
    <div className="mu__swatch">
      <div className="mu__swatch-color" style={{ background: hex }} />
      <div className="mu__swatch-info">
        <div className="mu__swatch-nombre">{nombre}</div>
        <div className="mu__swatch-hex">{hex}</div>
      </div>
    </div>
  );
}

export function Muestra() {
  const [pin, setPin] = useState('12');
  const [salsa, setSalsa] = useState('Rosada');

  return (
    <div className="mu">
      <header className="mu__cabecera">
        <img className="mu__logo" src={logo} alt="PARE Y COMA" />
        <div className="mu__marca">
          <h1>PARE Y COMA</h1>
          <p className="mu__lema">Deténgase ▸ Mastíquese ▸ Continúe</p>
        </div>
      </header>

      {/* ── TOKENS ─────────────────────────────────────────────── */}
      <section className="mu__seccion">
        <h2 className="mu__titulo">Tokens</h2>

        <p className="mu__sub">Superficies</p>
        <div className="mu__fila">
          {SUPERFICIES.map(([n, h]) => (
            <Swatch key={n} nombre={n} hex={h} />
          ))}
        </div>

        <p className="mu__sub">Tintas</p>
        <div className="mu__fila">
          {TINTAS.map(([n, h]) => (
            <Swatch key={n} nombre={n} hex={h} />
          ))}
        </div>

        <p className="mu__sub">Marca y semánticos</p>
        <div className="mu__fila">
          {MARCA.map(([n, h]) => (
            <Swatch key={n} nombre={n} hex={h} />
          ))}
        </div>

        <p className="mu__sub">Espaciado (8pt)</p>
        <div>
          {ESPACIOS.map(([n, px]) => (
            <div className="mu__esp" key={n}>
              <div className="mu__esp-barra" style={{ width: px }} />
              <span className="mu__esp-label">
                {n} · {px}px
              </span>
            </div>
          ))}
        </div>

        <p className="mu__sub">Radios</p>
        <div className="mu__fila">
          {RADIOS.map(([n, px]) => (
            <div className="mu__radio" key={n} style={{ borderRadius: px }}>
              <span>{n}</span>
            </div>
          ))}
        </div>

        <p className="mu__sub">Tipografía</p>
        <div>
          <div className="mu__tipo">
            <span className="mu__tipo-etq">Display · Bungee (mesas, turnos, total, títulos)</span>
            <span style={{ fontFamily: 'var(--fuente-display)', fontSize: 40 }}>MESA 3 · B-07</span>
          </div>
          <div className="mu__tipo">
            <span className="mu__tipo-etq">UI · DM Sans 400 / 500 / 700 / 800</span>
            <span style={{ fontWeight: 400 }}>Texto normal de interfaz</span>
            <span style={{ fontWeight: 500 }}>Etiqueta de campo</span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Chip en mayúscula
            </span>
            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Nombre de producto
            </span>
          </div>
          <div className="mu__tipo">
            <span className="mu__tipo-etq">Datos · DM Mono tabular (dinero, horas, cantidades)</span>
            <span className="dinero" style={{ fontSize: 22 }}>$ 48.500 · 12:45 · 3×</span>
          </div>
        </div>
      </section>

      {/* ── PRIMITIVAS ─────────────────────────────────────────── */}
      <section className="mu__seccion">
        <h2 className="mu__titulo">Primitivas</h2>

        <p className="mu__sub">Botón — variantes y estados</p>
        {(['primario', 'secundario', 'peligro', 'fantasma'] as const).map((v) => (
          <div className="mu__fila" key={v}>
            <Boton variante={v}>Normal</Boton>
            <Boton variante={v} data-demo="presionado">
              Presionado
            </Boton>
            <Boton variante={v} disabled>
              Deshabilitado
            </Boton>
          </div>
        ))}
        <div className="mu__fila">
          <Boton variante="primario" flujo bloque>
            Enviar pedido
          </Boton>
        </div>

        <p className="mu__sub">Chip</p>
        <div className="mu__fila">
          {['Rosada', 'Piña', 'Ají'].map((s) => (
            <Chip key={s} activo={salsa === s} onClick={() => setSalsa(s)}>
              {s}
            </Chip>
          ))}
          <Chip disabled>Sin queso</Chip>
        </div>

        <p className="mu__sub">Campo — normal, con valor y error</p>
        <div className="mu__fila">
          <div style={{ width: 220 }}>
            <Campo etiqueta="Nombre del cliente" placeholder="Ej: Pedro" />
          </div>
          <div style={{ width: 220 }}>
            <Campo etiqueta="Turno" defaultValue="B-07" />
          </div>
          <div style={{ width: 220 }}>
            <Campo etiqueta="Monto recibido" defaultValue="10" error="Falta cubrir la cuenta." />
          </div>
        </div>

        <p className="mu__sub">Tarjeta — plana y elevada</p>
        <div className="mu__fila">
          <Tarjeta style={{ padding: 'var(--esp-3)', width: 200 }}>Tarjeta (plana)</Tarjeta>
          <Tarjeta elevada style={{ padding: 'var(--esp-3)', width: 200 }}>
            Tarjeta elevada
          </Tarjeta>
        </div>

        <p className="mu__sub">Modal — confirmación destructiva</p>
        <Modal estatico titulo="¿Cancelar el pedido?">
          <p className="ds-modal__consecuencia">
            Se perderá la cuenta de la Mesa 3. Esto no se puede deshacer.
          </p>
          <div className="ds-modal__acciones">
            <Boton variante="secundario" bloque>
              Volver
            </Boton>
            <Boton variante="peligro" bloque>
              Sí, cancelar
            </Boton>
          </div>
        </Modal>

        <p className="mu__sub">Toast — placa vial por tono</p>
        <div className="mu__fila">
          <Toast estatico tono="exito">
            Mesa 3 cobrada.
          </Toast>
          <Toast estatico tono="coma">
            Quedan 4 gaseosas.
          </Toast>
          <Toast estatico tono="pare">
            No se pudo conectar.
          </Toast>
          <Toast estatico>Guardado.</Toast>
        </div>

        <p className="mu__sub">Skeleton — carga (nunca spinners)</p>
        <Tarjeta style={{ padding: 'var(--esp-3)', width: 260, display: 'grid', gap: 'var(--esp-2)' }}>
          <Skeleton ancho="60%" alto={18} />
          <Skeleton alto={14} />
          <Skeleton ancho="40%" alto={14} />
        </Tarjeta>
      </section>

      {/* ── PATRONES ───────────────────────────────────────────── */}
      <section className="mu__seccion">
        <h2 className="mu__titulo">Patrones</h2>

        <p className="mu__sub">TarjetaProducto</p>
        <div className="mu__grid">
          <TarjetaProducto nombre="Empanada de carne" precio={2500} />
          <TarjetaProducto nombre="Gaseosa 400 ml" precio={4000} stock={4} />
          <TarjetaProducto nombre="Choripapa" precio={12000} cantidad={2} />
          <TarjetaProducto nombre="Morcilla" precio={6000} agotado />
        </div>

        <p className="mu__sub">TarjetaMesa — 4 mesas en sus 3 estados + barra</p>
        <div className="mu__mesas">
          <TarjetaMesa numero={1} estado="libre" />
          <TarjetaMesa numero={2} estado="ocupada" total={33000} />
          <TarjetaMesa numero={3} estado="por_cobrar" total={82000} />
          <TarjetaMesa numero={4} estado="libre" />
          <TarjetaMesa variante="barra" turno="B-07" cliente="Pedro" estado="ocupada" total={24000} />
        </div>

        <p className="mu__sub">DisplayTotal</p>
        <div style={{ maxWidth: 320 }}>
          <DisplayTotal monto={48500} />
        </div>

        <p className="mu__sub">LineaPedido</p>
        <Tarjeta style={{ padding: 'var(--esp-3)', maxWidth: 420 }}>
          <LineaPedido cantidad={2} nombre="Choripapa" subtotal={24000} onQuitar={() => {}} />
          <LineaPedido cantidad={1} nombre="Gaseosa 400 ml" subtotal={4000} onQuitar={() => {}} />
        </Tarjeta>

        <p className="mu__sub">TecladoPin</p>
        <div style={{ maxWidth: 280 }}>
          <TecladoPin valor={pin} onCambio={setPin} onEnter={() => {}} />
        </div>
      </section>

      {/* ── CONTRASTE ──────────────────────────────────────────── */}
      <section className="mu__seccion">
        <h2 className="mu__titulo">Contraste AA</h2>
        <p className="mu__nota">
          Cada combinación tinta/superficie del sistema, con su razón de contraste calculada. AA exige
          4.5:1 en texto normal y 3:1 en texto grande.
        </p>
        <div className="mu__tabla-cont">
          <table className="mu__tabla">
            <thead>
              <tr>
                <th>Combinación</th>
                <th>Muestra</th>
                <th>Razón</th>
                <th>Veredicto</th>
              </tr>
            </thead>
            <tbody>
              {COMBOS.map((c) => {
                const ratio = razonContraste(c.fg, c.bg);
                const v = veredictoAA(ratio);
                const clase = v === 'AA' ? 'aa' : v === 'AA grande' ? 'grande' : 'no';
                return (
                  <tr key={c.etq}>
                    <td>{c.etq}</td>
                    <td>
                      <span className="mu__muestra-txt" style={{ color: c.fg, background: c.bg }}>
                        Texto
                      </span>
                    </td>
                    <td className="mu__ratio">{ratio.toFixed(2)}:1</td>
                    <td className={`mu__veredicto mu__veredicto--${clase}`}>{v}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
