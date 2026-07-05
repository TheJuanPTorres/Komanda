// Editor de producto (crear o editar) dentro de un Modal. Incluye la opción de
// subir/quitar la foto. En creación, primero se guarda el producto y luego se
// sube la foto elegida (el endpoint de imagen necesita el id).
import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Categoria, GuardarProductoReq, Producto } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { aEnteroDesdeTexto } from '../../lib/numeros.js';
import { Boton, Campo, Chip, Modal } from '../../design-system/index.js';
import './productos.css';

interface Props {
  categorias: Categoria[];
  // Producto a editar, o null para crear uno nuevo.
  producto: Producto | null;
  onCerrar: () => void;
  onGuardado: (p: Producto) => void;
}

// Sube la foto por multipart (fetch directo: el helper api es JSON).
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
    throw new ErrorApi(err?.codigo ?? 'ERROR', err?.mensaje ?? 'No se pudo subir la foto.', resp.status);
  }
  return cuerpo.producto as Producto;
}

export function EditorProducto({ categorias, producto, onCerrar, onGuardado }: Props) {
  const editando = producto !== null;

  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [categoriaId, setCategoriaId] = useState<number>(
    producto?.categoria_id ?? categorias[0]?.id ?? 0
  );
  const [precio, setPrecio] = useState(producto?.precio ?? 0);
  const [costo, setCosto] = useState(producto?.costo ?? 0);
  const [controlaStock, setControlaStock] = useState(producto?.controla_stock ?? false);
  const [stock, setStock] = useState(producto?.stock ?? 0);
  const [stockMinimo, setStockMinimo] = useState(producto?.stock_minimo ?? 0);

  // Foto: la que ya tiene (URL) o una nueva elegida (File con vista previa).
  const [imagenUrl, setImagenUrl] = useState<string | null>(producto?.imagen ?? null);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';
  const puedeGuardar = nombre.trim().length > 0 && categoriaId > 0 && !ocupado;

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setArchivoNuevo(f);
    setVistaPrevia(URL.createObjectURL(f));
  }

  async function guardar() {
    if (!puedeGuardar) return;
    setOcupado(true);
    setError('');
    const cuerpo: GuardarProductoReq = {
      categoria_id: categoriaId,
      nombre: nombre.trim(),
      precio,
      costo,
      controla_stock: controlaStock,
      stock: controlaStock ? stock : 0,
      stock_minimo: controlaStock ? stockMinimo : 0
    };
    try {
      let guardado: Producto;
      if (editando) {
        guardado = (await api.patch<{ producto: Producto }>(`/api/productos/${producto.id}`, cuerpo))
          .producto;
      } else {
        guardado = (await api.post<{ producto: Producto }>('/api/productos', cuerpo)).producto;
      }
      // Foto: si se eligió una nueva, subirla; si se pidió quitar, borrarla.
      if (archivoNuevo) {
        guardado = await subirImagen(guardado.id, archivoNuevo);
      } else if (editando && producto.imagen && imagenUrl === null) {
        guardado = (await api.delete<{ producto: Producto }>(`/api/productos/${guardado.id}/imagen`))
          .producto;
      }
      onGuardado(guardado);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar el producto.');
      setOcupado(false);
    }
  }

  const fotoMostrada = vistaPrevia ?? imagenUrl;

  return (
    <Modal
      titulo={editando ? 'Editar producto' : 'Nuevo producto'}
      className="ds-modal--ancho"
      onCerrar={() => !ocupado && onCerrar()}
    >
      <div className="pedit">
        {error && <div className="aviso-error">{error}</div>}

        <Campo
          etiqueta="Nombre"
          value={nombre}
          maxLength={80}
          autoFocus
          placeholder="Ej: Empanada de carne"
          onChange={(e) => setNombre(e.target.value)}
        />

        <div className="pedit__grupo">
          <span className="ds-campo__etiqueta">Categoría</span>
          <div className="pedit__chips">
            {categorias.map((c) => (
              <Chip key={c.id} activo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>
                {c.nombre}
              </Chip>
            ))}
          </div>
        </div>

        <div className="pedit__fila">
          <Campo
            etiqueta="Precio"
            inputMode="numeric"
            value={precio === 0 ? '' : String(precio)}
            placeholder="0"
            onChange={(e) => setPrecio(aEnteroDesdeTexto(e.target.value))}
          />
          <Campo
            etiqueta="Costo"
            inputMode="numeric"
            value={costo === 0 ? '' : String(costo)}
            placeholder="0"
            onChange={(e) => setCosto(aEnteroDesdeTexto(e.target.value))}
          />
        </div>

        <div className="pedit__grupo">
          <span className="ds-campo__etiqueta">Inventario</span>
          <div className="pedit__chips">
            <Chip activo={!controlaStock} onClick={() => setControlaStock(false)}>
              No controla
            </Chip>
            <Chip activo={controlaStock} onClick={() => setControlaStock(true)}>
              Controla stock
            </Chip>
          </div>
        </div>

        {controlaStock && (
          <div className="pedit__fila">
            <Campo
              etiqueta="Stock actual"
              inputMode="numeric"
              value={stock === 0 ? '' : String(stock)}
              placeholder="0"
              onChange={(e) => setStock(aEnteroDesdeTexto(e.target.value))}
            />
            <Campo
              etiqueta="Stock mínimo"
              inputMode="numeric"
              value={stockMinimo === 0 ? '' : String(stockMinimo)}
              placeholder="0"
              onChange={(e) => setStockMinimo(aEnteroDesdeTexto(e.target.value))}
            />
          </div>
        )}

        <div className="pedit__grupo">
          <span className="ds-campo__etiqueta">Foto</span>
          <div className="pedit__foto">
            <div className="pedit__foto-vista">
              {fotoMostrada ? (
                <img src={fotoMostrada} alt="" />
              ) : (
                <span className="pedit__foto-inicial">{inicial}</span>
              )}
            </div>
            <div className="pedit__foto-btns">
              <input
                ref={inputRef}
                className="pedit__file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={elegirArchivo}
              />
              <Boton variante="secundario" disabled={ocupado} onClick={() => inputRef.current?.click()}>
                <ImagePlus size={20} strokeWidth={2.25} />
                {fotoMostrada ? 'Cambiar' : 'Subir'}
              </Boton>
              {fotoMostrada && (
                <Boton
                  variante="peligro"
                  disabled={ocupado}
                  onClick={() => {
                    setArchivoNuevo(null);
                    setVistaPrevia(null);
                    setImagenUrl(null);
                  }}
                >
                  <Trash2 size={20} strokeWidth={2.25} />
                  Quitar
                </Boton>
              )}
            </div>
          </div>
        </div>

        <div className="pedit__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={!puedeGuardar} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
