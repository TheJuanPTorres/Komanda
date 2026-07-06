// Aviso fijo cuando el socket pierde la conexión (internet caído / datos).
// Escucha connect/disconnect del socket; no sondea. Se muestra solo si hay
// sesión activa (si no, no hay socket conectado y no aplica).
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { socket } from '../../lib/socket.js';
import './indicador-conexion.css';

export function IndicadorConexion() {
  const [conectado, setConectado] = useState(socket.connected);

  useEffect(() => {
    const onConectar = () => setConectado(true);
    const onDesconectar = () => setConectado(false);
    socket.on('connect', onConectar);
    socket.on('disconnect', onDesconectar);
    return () => {
      socket.off('connect', onConectar);
      socket.off('disconnect', onDesconectar);
    };
  }, []);

  if (conectado) return null;

  return (
    <div className="conexion" role="status" aria-live="polite">
      <WifiOff size={18} strokeWidth={2.25} />
      <span>Sin conexión — revisa tu internet o usa datos móviles</span>
    </div>
  );
}
