import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/tokens.css';
import { App } from './App.js';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el nodo raíz.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>
);
