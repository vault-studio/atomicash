// Entrada de editor.html: editor de eventos especiales. Solo existe en `npm run dev` (no está en el build).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './editor.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
