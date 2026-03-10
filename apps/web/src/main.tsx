import { Profiler, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './index.css';
import { recordReactCommit } from './lib/performance.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Profiler id="app" onRender={recordReactCommit}>
      <App />
    </Profiler>
  </StrictMode>,
);
