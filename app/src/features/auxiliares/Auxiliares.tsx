// Administración de auxiliares (solo admin): crear, renombrar, asignar PIN y
// desactivar. En internet público cada auxiliar entra con nombre + PIN de 4.
import { useEffect, useState } from 'react';
import { KeyRound, LockOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Usuario } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Campo, Modal, Toast } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import { Cargando } from '../comunes/Cargando.js';
import './auxiliares.css';

const soloDigitos = (v: string) => v.replace(/\D/g, '');

// Editor de crear/renombrar. Al crear pide también el PIN (4 dígitos).
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
  const [pin, setPin] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const pinOk = editando || pin.length === 4;

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio || !pinOk) return;
    setOcupado(true);
    setError('');
    try {
      const { auxiliar: a } = editando
        ? await api.patch<{ auxiliar: Usuario }>(`/api/usuarios/auxiliares/${auxiliar.id}`, {
            nombre: limpio
          })
        : await api.post<{ auxiliar: Usuario }>('/api/usuarios/auxiliares', { nombre: limpio, pin });
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
        {!editando && (
          <Campo
            etiqueta="PIN (4 dígitos)"
            inputMode="numeric"
            value={pin}
            maxLength={4}
            placeholder="****"
            onChange={(e) => setPin(soloDigitos(e.target.value).slice(0, 4))}
          />
        )}
        <div className="aux-form__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={ocupado || !nombre.trim() || !pinOk} onClick={guardar}>
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

// Modal para asignar/restablecer el PIN de un auxiliar existente.
function EditorPin({
  auxiliar,
  onCerrar,
  onGuardado
}: {
  auxiliar: Usuario;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [pin, setPin] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    if (pin.length !== 4) return;
    setOcupado(true);
    setError('');
    try {
      await api.put(`/api/usuarios/auxiliares/${auxiliar.id}/pin`, { pin });
      onGuardado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo asignar el PIN.');
      setOcupado(false);
    }
  }

  return (
    <Modal titulo={`PIN de ${auxiliar.nombre}`} onCerrar={() => !ocupado && onCerrar()}>
      <div className="aux-form">
        {error && <div className="aviso-error">{error}</div>}
        <Campo
          etiqueta="PIN nuevo (4 dígitos)"
          inputMode="numeric"
          value={pin}
          maxLength={4}
          autoFocus
          placeholder="****"
          onChange={(e) => setPin(soloDigitos(e.target.value).slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
        <div className="aux-form__acciones">
          <Boton variante="secundario" bloque disabled={ocupado} onClick={onCerrar}>
            Volver
          </Boton>
          <Boton flujo bloque disabled={ocupado || pin.length !== 4} onClick={guardar}>
            Guardar PIN
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

export function Auxiliares() {
  const navegar = useNavigate();
  const sesion = useStore((s) => s.sesion);
  const [auxiliares, setAuxiliares] = useState<Usuario[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState<Usuario | 'nuevo' | undefined>(undefined);
  const [pinDe, setPinDe] = useState<Usuario | null>(null);
  const [porEliminar, setPorEliminar] = useState<Usuario | null>(null);

  // Muestra un aviso breve (toast) y lo oculta solo.
  function mostrarAviso(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(''), 2500);
  }

  // Limpia el contador de bloqueo por cuenta al instante (auxiliar o admin).
  async function desbloquear(id: number, nombre: string) {
    setError('');
    try {
      await api.post(`/api/usuarios/${id}/desbloquear`);
      mostrarAviso(`Cuenta desbloqueada: ${nombre}`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo desbloquear.');
    }
  }

  function recargar() {
    api
      .get<{ auxiliares: Usuario[] }>('/api/usuarios/auxiliares')
      .then((r) => setAuxiliares(r.auxiliares))
      .catch(() => setError('No se pudo cargar la lista.'));
  }
  useEffect(recargar, []);

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

        {/* Desbloqueo de la cuenta admin (por si la bloquean con intentos). */}
        {sesion && (
          <div className="aux-admin">
            <span className="aux-admin__txt">Cuenta de administrador</span>
            <Boton variante="secundario" onClick={() => desbloquear(sesion.id, 'Administrador')}>
              <LockOpen size={20} strokeWidth={2.25} />
              Desbloquear
            </Boton>
          </div>
        )}

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
                {!a.tiene_pin && <span className="aux__sinpin">Sin PIN</span>}
                <Boton
                  variante="secundario"
                  onClick={() => desbloquear(a.id, a.nombre)}
                  aria-label="Desbloquear"
                >
                  <LockOpen size={20} strokeWidth={2.25} />
                </Boton>
                <Boton variante="secundario" onClick={() => setPinDe(a)} aria-label="Asignar PIN">
                  <KeyRound size={20} strokeWidth={2.25} />
                </Boton>
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

      {pinDe && (
        <EditorPin
          auxiliar={pinDe}
          onCerrar={() => setPinDe(null)}
          onGuardado={() => {
            setPinDe(null);
            recargar();
          }}
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

      {aviso && <Toast tono="exito">{aviso}</Toast>}
    </div>
  );
}
