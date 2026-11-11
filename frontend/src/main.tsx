import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/alfa-slab-one/latin-400.css';
import '@fontsource/playfair-display/latin-900.css';
import '@fontsource/pacifico/latin-400.css';
import '@fontsource/lobster/latin-400.css';
import '@fontsource/permanent-marker/latin-400.css';
import '@fontsource/bangers/latin-400.css';
import '@fontsource/luckiest-guy/latin-400.css';
import '@fontsource/righteous/latin-400.css';
import '@fontsource/special-elite/latin-400.css';
import './atomm.css';
import './app.css';
import App from './App.tsx';
import { loadFonts } from './app/sources';

// Text is traced from a canvas, which silently falls back to a system font until the
// web font has loaded — so wait for the lettering before the first render.
void loadFonts().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
