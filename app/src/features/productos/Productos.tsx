// Administración del catálogo (solo admin): crear, editar, desactivar productos
// y gestionar su foto. La lista se agrupa por categoría.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Categoria, Producto } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { formatearDinero } from '../../design-system/index.js';
import { Boton, Modal } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import { Cargando } from '../comunes/Cargando.js';
import { EditorProducto } from './EditorProducto.js';
import './productos.css';

export function Productos() {
  const navegar = useNavigate();
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState('');

  // Editor: 'nuevo', un producto a editar, o cerrado (undefined).
  const [editando, setEditando] = useState<Producto | 'nuevo' | undefined>(undefined);
  const [porEliminar, setPorEliminar] = useState<Producto | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ productos: Producto[] }>('/api/productos'),
      api.get<{ categorias: Categoria[] }>('/api/categorias')
    ])
      .then(([p, c]) => {
        setProductos(p.productos);
        setCategorias(c.categorias);
      })
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  // Agrupa los productos por categoría (en el orden de las categorías).
  const grupos = useMemo(() => {
    const porCat = new Map<number, Producto[]>();
    for (const p of productos ?? []) {
      const lista = porCat.get(p.categoria_id ?? -1) ?? [];
      lista.push(p);
      porCat.set(p.categoria_id ?? -1, lista);
    }
    return categorias
      .map((c) => ({ categoria: c, items: porCat.get(c.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [productos, categorias]);

  function trasGuardar(p: Producto) {
    setProductos((prev) => {
      const base = prev ?? [];
      return base.some((x) => x.id === p.id)
        ? base.map((x) => (x.id === p.id ? p : x))
        : [...base, p];
    });
    setEditando(undefined);
  }

  async function eliminar(p: Producto) {
    setPorEliminar(null);
    try {
      await api.delete(`/api/productos/${p.id}`);
      setProductos((prev) => (prev ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo desactivar el producto.');
    }
  }

  if (productos === null && !error) return <Cargando />;

  return (
    <div className="pagina">
      <Encabezado
        titulo="Productos"
        subtitulo="Catálogo del negocio"
        onVolver={() => navegar('/')}
        acciones={
          <>
            <Boton onClick={() => setEditando('nuevo')}>
              <Plus size={20} strokeWidth={2.25} />
              Nuevo
            </Boton>
            <NavAdmin />
          </>
        }
      />

      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}

        {grupos.length === 0 ? (
          <p className="vacio">
            <strong>Catálogo vacío.</strong>
            Toca “Nuevo” para agregar el primer producto.
          </p>
        ) : (
          grupos.map((g) => (
            <section key={g.categoria.id}>
              <h2 className="prod-grupo-titulo">{g.categoria.nombre}</h2>
              <div className="prod-lista">
                {g.items.map((p) => {
                  const inicial = p.nombre.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <div className="prod" key={p.id}>
                      <div className="prod__foto">
                        {p.imagen ? (
                          <img className="prod__img" src={p.imagen} alt="" />
                        ) : (
                          <span className="prod__inicial">{inicial}</span>
                        )}
                      </div>
                      <div className="prod__info">
                        <div className="prod__nombre">{p.nombre}</div>
                        <div className="prod__meta">
                          <span className="prod__precio">{formatearDinero(p.precio)}</span>
                          {p.costo === 0 && <span className="prod__tag prod__tag--sincosto">Sin costo</span>}
                          {p.controla_stock && (
                            <span className="prod__tag prod__tag--stock">Stock {p.stock}</span>
                          )}
                        </div>
                      </div>
                      <Boton variante="secundario" onClick={() => setEditando(p)} aria-label="Editar">
                        <Pencil size={20} strokeWidth={2.25} />
                      </Boton>
                      <Boton variante="peligro" onClick={() => setPorEliminar(p)} aria-label="Desactivar">
                        <Trash2 size={20} strokeWidth={2.25} />
                      </Boton>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {editando !== undefined && (
        <EditorProducto
          categorias={categorias}
          producto={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={trasGuardar}
        />
      )}

      {porEliminar && (
        <Modal titulo="¿Quitar del catálogo?" onCerrar={() => setPorEliminar(null)}>
          <p className="ds-modal__consecuencia">
            “{porEliminar.nombre}” dejará de aparecer en el menú. Las ventas anteriores no se tocan.
          </p>
          <div className="ds-modal__acciones">
            <Boton variante="secundario" bloque onClick={() => setPorEliminar(null)}>
              Volver
            </Boton>
            <Boton variante="peligro" bloque onClick={() => eliminar(porEliminar)}>
              Sí, quitar
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
