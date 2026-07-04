// Administración del catálogo (solo admin): subir, cambiar o quitar la foto
// de cada producto. La foto se procesa en el servidor (webp, máx 800px).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Producto } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { formatearDinero } from '../../design-system/index.js';
import { Boton } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { Cargando } from '../comunes/Cargando.js';
import './productos.css';

// Sube la imagen por multipart (fetch directo: el helper api es JSON).
async function subirImagen(id: number, archivo: File): Promise<Producto> {
  const datos = new FormData();
  datos.append('imagen', archivo);
  const resp = await fetch(`/api/productos/${id}/imagen`, {
    method: 'POST',
    credentials: 'same-origin',
    body: datos
  });
  const cuerpo = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = cuerpo?.error;
    throw new ErrorApi(err?.codigo ?? 'ERROR', err?.mensaje ?? 'No se pudo subir la imagen.', resp.status);
  }
  return cuerpo.producto as Producto;
}

function FilaProducto({
  producto,
  onCambio
}: {
  producto: Producto;
  onCambio: (p: Producto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const inicial = producto.nombre.trim().charAt(0).toUpperCase() || '?';

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (!archivo) return;
    setOcupado(true);
    setError('');
    try {
      onCambio(await subirImagen(producto.id, archivo));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setOcupado(false);
    }
  }

  async function quitar() {
    setOcupado(true);
    setError('');
    try {
      const { producto: p } = await api.delete<{ producto: Producto }>(
        `/api/productos/${producto.id}/imagen`
      );
      onCambio(p);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo quitar la imagen.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="prod">
      <div className="prod__foto">
        {producto.imagen ? (
          <img className="prod__img" src={producto.imagen} alt="" />
        ) : (
          <span className="prod__inicial">{inicial}</span>
        )}
      </div>

      <div className="prod__info">
        <div className="prod__nombre">{producto.nombre}</div>
        <div className="prod__precio">{formatearDinero(producto.precio)}</div>
        {producto.costo === 0 && <span className="prod__sincosto">Sin costo</span>}
        {error && <div className="aviso-error" style={{ marginTop: 'var(--esp-2)' }}>{error}</div>}
      </div>

      <div className="prod__acciones">
        <input
          ref={inputRef}
          className="prod__file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={alElegir}
        />
        <Boton variante="secundario" disabled={ocupado} onClick={() => inputRef.current?.click()}>
          <ImagePlus size={20} strokeWidth={2.25} />
          {producto.imagen ? 'Cambiar' : 'Foto'}
        </Boton>
        {producto.imagen && (
          <Boton variante="peligro" disabled={ocupado} onClick={quitar}>
            <Trash2 size={20} strokeWidth={2.25} />
            Quitar
          </Boton>
        )}
      </div>
    </div>
  );
}

export function Productos() {
  const navegar = useNavigate();
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ productos: Producto[] }>('/api/productos')
      .then((r) => setProductos(r.productos))
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  function aplicar(p: Producto) {
    setProductos((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
  }

  if (productos === null && !error) return <Cargando />;

  return (
    <div className="pagina">
      <Encabezado titulo="Productos" subtitulo="Fotos del catálogo" onVolver={() => navegar('/')} />
      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}
        <div className="prod-lista">
          {(productos ?? []).map((p) => (
            <FilaProducto key={p.id} producto={p} onCambio={aplicar} />
          ))}
        </div>
      </div>
    </div>
  );
}
