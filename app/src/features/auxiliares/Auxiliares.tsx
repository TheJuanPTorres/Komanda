// Administración de auxiliares (solo admin): crear, renombrar y desactivar.
// Los auxiliares no tienen PIN: entran tocando su nombre en el acceso.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Usuario } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { Boton, Campo, Modal } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import { Cargando } from '../comunes/Cargando.js';
import './auxiliares.css';

// Editor simple (crear/renombrar) en un Modal.
function EditorAuxiliar({
  auxiliar,
  onCerrar,
  onGuardado
}: {
  auxiliar: Usuario | null;
  onCerrar: () => void;
  onGuardado: (a: Usuario) => void;
}) {
  const editando = auxiliar !== null;
  const [nombre, setNombre] = useState(auxiliar?.nombre ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) return;
    setOcupado(true);
    setError('');
    try {
      const { auxiliar: a } = editando
        ? await api.patch<{ auxiliar: Usuario }>(`/api/usuarios/auxiliares/${auxiliar.id}`, {
            nombre: limpio
          })
        : await api.post<{ auxiliar: Usuario }>('/api/usuarios/auxiliares', { nombre: limpio });
      onGuardado(a);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={editando ? 'Renombrar auxiliar' : 'Nuevo auxiliar'} onCerrar={() => !ocupado && onCerrar()}>
      <div className="aux-form">
        {error && <div className="aviso-error">{error}</div>}
        <Campo
          etiqueta="Nombre"
          value={nombre}
          maxLength={40}
          autoFocus
          placeholder="Ej: Camila"
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
        <div className="aux-form__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={ocupado || !nombre.trim()} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

export function Auxiliares() {
  const navegar = useNavigate();
  const [auxiliares, setAuxiliares] = useState<Usuario[] | null>(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<Usuario | 'nuevo' | undefined>(undefined);
  const [porEliminar, setPorEliminar] = useState<Usuario | null>(null);

  useEffect(() => {
    api
      .get<{ auxiliares: Usuario[] }>('/api/usuarios/auxiliares')
      .then((r) => setAuxiliares(r.auxiliares))
      .catch(() => setError('No se pudo cargar la lista.'));
  }, []);

  function trasGuardar(a: Usuario) {
    setAuxiliares((prev) => {
      const base = prev ?? [];
      const lista = base.some((x) => x.id === a.id)
        ? base.map((x) => (x.id === a.id ? a : x))
        : [...base, a];
      return lista.sort((x, y) => x.nombre.localeCompare(y.nombre));
    });
    setEditando(undefined);
  }

  async function eliminar(a: Usuario) {
    setPorEliminar(null);
    try {
      await api.delete(`/api/usuarios/auxiliares/${a.id}`);
      setAuxiliares((prev) => (prev ?? []).filter((x) => x.id !== a.id));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo desactivar.');
    }
  }

  if (auxiliares === null && !error) return <Cargando />;

  return (
    <div className="pagina">
      <Encabezado
        titulo="Auxiliares"
        subtitulo="Quién toma pedidos"
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

        {(auxiliares ?? []).length === 0 ? (
          <p className="vacio">
            <strong>Nadie registrado.</strong>
            Toca “Nuevo” para agregar el primer auxiliar.
          </p>
        ) : (
          <div className="aux-lista">
            {(auxiliares ?? []).map((a) => (
              <div className="aux" key={a.id}>
                <span className="aux__inicial">{a.nombre.trim().charAt(0).toUpperCase()}</span>
                <span className="aux__nombre">{a.nombre}</span>
                <Boton variante="secundario" onClick={() => setEditando(a)} aria-label="Renombrar">
                  <Pencil size={20} strokeWidth={2.25} />
                </Boton>
                <Boton variante="peligro" onClick={() => setPorEliminar(a)} aria-label="Desactivar">
                  <Trash2 size={20} strokeWidth={2.25} />
                </Boton>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando !== undefined && (
        <EditorAuxiliar
          auxiliar={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={trasGuardar}
        />
      )}

      {porEliminar && (
        <Modal titulo="¿Sacar del turno?" onCerrar={() => setPorEliminar(null)}>
          <p className="ds-modal__consecuencia">
            “{porEliminar.nombre}” ya no aparecerá en la pantalla de acceso. Sus pedidos anteriores no
            se tocan.
          </p>
          <div className="ds-modal__acciones">
            <Boton variante="secundario" bloque onClick={() => setPorEliminar(null)}>
              Volver
            </Boton>
            <Boton variante="peligro" bloque onClick={() => eliminar(porEliminar)}>
              Sí, sacar
            </Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
