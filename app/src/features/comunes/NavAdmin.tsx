// Navegación del administrador (v1.5-C, Parte 3): en el encabezado de cada
// pantalla de admin. En móvil es un botón hamburguesa que abre un drawer lateral
// con toda la navegación; el badge de correcciones pendientes queda SIEMPRE
// visible fuera del drawer (esa alerta no puede esconderse). En pantallas
// anchas (≥1024px) el drawer aparece fijo como panel lateral. Los auxiliares
// solo ven "Salir".
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  Home,
  Lock,
  LogOut,
  Menu as MenuIcono,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { useStore } from '../../estado/store.js';

const SECCIONES = [
  { ruta: '/', etiqueta: 'Piso', Icono: Home },
  { ruta: '/ventas', etiqueta: 'Ventas', Icono: ShoppingBag },
  { ruta: '/productos', etiqueta: 'Productos', Icono: Package },
  { ruta: '/gastos', etiqueta: 'Gastos', Icono: Wallet },
  { ruta: '/cierre', etiqueta: 'Cierre', Icono: Lock },
  { ruta: '/reportes', etiqueta: 'Reportes', Icono: BarChart3 },
  { ruta: '/auxiliares', etiqueta: 'Equipo', Icono: Users },
  { ruta: '/configuracion', etiqueta: 'Ajustes', Icono: Settings }
] as const;

// Marca activa: '/' solo cuando es exactamente el piso; el resto por prefijo.
function esActiva(pathname: string, ruta: string): boolean {
  return ruta === '/' ? pathname === '/' : pathname.startsWith(ruta);
}

export function NavAdmin() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const sesion = useStore((s) => s.sesion);
  const salir = useStore((s) => s.salir);
  const pendientes = useStore((s) => s.correcciones.length);
  const [abierto, setAbierto] = useState(false);

  const esAdmin = sesion?.rol === 'admin';

  // Cierra el drawer al cambiar de ruta.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  function ir(ruta: string) {
    setAbierto(false);
    navegar(ruta);
  }

  // Auxiliar: solo "Salir".
  if (!esAdmin) {
    return (
      <nav className="nav-admin">
        <button className="nav-admin__salir-aux" onClick={() => salir()}>
          <LogOut size={18} strokeWidth={2.25} />
          <span>Salir</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="nav-admin">
      {/* Alerta de correcciones: SIEMPRE visible fuera del drawer. */}
      {pendientes > 0 && (
        <button
          className={`nav-admin__alerta ${pathname.startsWith('/correcciones') ? 'nav-admin__alerta--activa' : ''}`}
          onClick={() => navegar('/correcciones')}
          aria-label={`${pendientes} correcciones pendientes`}
        >
          <ClipboardList size={18} strokeWidth={2.25} />
          <span className="nav-admin__badge">{pendientes}</span>
        </button>
      )}

      {/* Hamburguesa: abre el drawer. */}
      <button
        className="nav-admin__hamburguesa"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
      >
        <MenuIcono size={24} strokeWidth={2.25} />
      </button>

      {/* Drawer lateral + overlay. */}
      {abierto && (
        <div className="nav-drawer__fondo" onClick={() => setAbierto(false)}>
          <div
            className="nav-drawer"
            role="dialog"
            aria-label="Navegación"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nav-drawer__cab">
              <span className="nav-drawer__marca">Komanda</span>
              <button
                className="nav-drawer__cerrar"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
              >
                <X size={24} strokeWidth={2.25} />
              </button>
            </div>

            {pendientes > 0 && (
              <button
                className={`nav-drawer__item nav-drawer__item--corr ${pathname.startsWith('/correcciones') ? 'nav-drawer__item--activo' : ''}`}
                onClick={() => ir('/correcciones')}
              >
                <ClipboardList size={20} strokeWidth={2.25} />
                <span>Correcciones</span>
                <span className="nav-admin__badge">{pendientes}</span>
              </button>
            )}

            {SECCIONES.map(({ ruta, etiqueta, Icono }) => {
              const activo = esActiva(pathname, ruta);
              return (
                <button
                  key={ruta}
                  className={`nav-drawer__item ${activo ? 'nav-drawer__item--activo' : ''}`}
                  aria-current={activo ? 'page' : undefined}
                  onClick={() => ir(ruta)}
                >
                  <Icono size={20} strokeWidth={2.25} />
                  <span>{etiqueta}</span>
                </button>
              );
            })}

            <button className="nav-drawer__item nav-drawer__salir" onClick={() => salir()}>
              <LogOut size={20} strokeWidth={2.25} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
