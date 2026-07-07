// Enrutado de la app. Tres pantallas: acceso, piso y tomar pedido.
// Las dos últimas exigen sesión; sin sesión se redirige a /acceso.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from './estado/store.js';
import { Acceso } from './features/acceso/Acceso.js';
import { Piso } from './features/piso/Piso.js';
import { TomarPedido } from './features/pedido/TomarPedido.js';
import { Gastos } from './features/gastos/Gastos.js';
import { Cierre } from './features/cierre/Cierre.js';
import { Reportes } from './features/reportes/Reportes.js';
import { Productos } from './features/productos/Productos.js';
import { Auxiliares } from './features/auxiliares/Auxiliares.js';
import { Correcciones } from './features/correcciones/Correcciones.js';
import { Ventas } from './features/ventas/Ventas.js';
import { VentaFicha } from './features/ventas/VentaFicha.js';
import { Muestra } from './muestra/Muestra.js';

function Protegida({ children, soloAdmin }: { children: ReactNode; soloAdmin?: boolean }) {
  const sesion = useStore((s) => s.sesion);
  if (!sesion) return <Navigate to="/acceso" replace />;
  // Las pantallas de caja (gastos, cierre) son solo para admin.
  if (soloAdmin && sesion.rol !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function Rutas() {
  const sesion = useStore((s) => s.sesion);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/acceso" element={sesion ? <Navigate to="/" replace /> : <Acceso />} />
        <Route
          path="/"
          element={
            <Protegida>
              <Piso />
            </Protegida>
          }
        />
        <Route
          path="/pedido/:id"
          element={
            <Protegida>
              <TomarPedido />
            </Protegida>
          }
        />
        <Route
          path="/gastos"
          element={
            <Protegida soloAdmin>
              <Gastos />
            </Protegida>
          }
        />
        <Route
          path="/cierre"
          element={
            <Protegida soloAdmin>
              <Cierre />
            </Protegida>
          }
        />
        <Route
          path="/reportes"
          element={
            <Protegida soloAdmin>
              <Reportes />
            </Protegida>
          }
        />
        <Route
          path="/productos"
          element={
            <Protegida soloAdmin>
              <Productos />
            </Protegida>
          }
        />
        <Route
          path="/auxiliares"
          element={
            <Protegida soloAdmin>
              <Auxiliares />
            </Protegida>
          }
        />
        <Route
          path="/correcciones"
          element={
            <Protegida soloAdmin>
              <Correcciones />
            </Protegida>
          }
        />
        <Route
          path="/ventas"
          element={
            <Protegida soloAdmin>
              <Ventas />
            </Protegida>
          }
        />
        <Route
          path="/ventas/:id"
          element={
            <Protegida soloAdmin>
              <VentaFicha />
            </Protegida>
          }
        />
        {/* Storybook del sistema de diseño, solo en desarrollo. */}
        {import.meta.env.DEV && <Route path="/muestra" element={<Muestra />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
