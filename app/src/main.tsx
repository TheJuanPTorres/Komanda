// MODO REVISIÓN DEL SISTEMA DE DISEÑO (Fase de diseño).
// Mientras se aprueba el sistema, la app arranca en la página de muestra
// (storybook). Las pantallas de producto se reconstruirán sobre el sistema
// aprobado y este entry volverá a montar el router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/fuentes.js';
import './design-system/tokens.css';
import { Muestra } from './muestra/Muestra.js';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el nodo raíz.');

createRoot(raiz).render(
  <StrictMode>
    <Muestra />
  </StrictMode>
);
