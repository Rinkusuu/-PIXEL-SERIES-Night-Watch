import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style/tokens.css';
import './style/base.css';
import './style/components.css';
import { App } from './App';
import { initServiceWorker } from './app/offline';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initServiceWorker();
