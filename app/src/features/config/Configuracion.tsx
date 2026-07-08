// Ajustes del admin. Por ahora, el número de WhatsApp al que se comparte el
// resumen de cierre. El servidor normaliza y valida el número.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConfigNegocio } from '@pos/shared';
import { api, ErrorApi } from '../../lib/api.js';
import { useStore } from '../../estado/store.js';
import { Boton, Campo } from '../../design-system/index.js';
import { Encabezado } from '../comunes/Encabezado.js';
import { NavAdmin } from '../comunes/NavAdmin.js';
import { Cargando } from '../comunes/Cargando.js';
import './config.css';

export function Configuracion() {
  const navegar = useNavigate();
  const mostrarAviso = useStore((s) => s.mostrarAviso);
  const [cargado, setCargado] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<ConfigNegocio>('/api/config')
      .then((c) => setWhatsapp(c.whatsapp_cierre ?? ''))
      .catch(() => setError('No se pudo cargar la configuración.'))
      .finally(() => setCargado(true));
  }, []);

  async function guardar() {
    setOcupado(true);
    setError('');
    try {
      const c = await api.put<ConfigNegocio>('/api/config', { whatsapp_cierre: whatsapp });
      setWhatsapp(c.whatsapp_cierre ?? '');
      mostrarAviso('Configuración guardada.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  if (!cargado) return <Cargando />;

  return (
    <div className="pagina">
      <Encabezado
        titulo="Ajustes"
        subtitulo="Configuración del negocio"
        onVolver={() => navegar('/')}
        acciones={<NavAdmin />}
      />

      <div className="pagina__cuerpo">
        {error && <div className="aviso-error">{error}</div>}

        <Campo
          etiqueta="WhatsApp para el resumen de cierre"
          value={whatsapp}
          inputMode="tel"
          maxLength={20}
          placeholder="Ej: 573001234567"
          onChange={(e) => setWhatsapp(e.target.value)}
        />
        <p className="cfg__ayuda">
          Con indicativo del país, solo números. Si lo dejas vacío, el botón “Compartir resumen”
          te deja elegir el contacto al momento.
        </p>

        <Boton flujo bloque disabled={ocupado} onClick={guardar}>
          Guardar
        </Boton>
      </div>
    </div>
  );
}
