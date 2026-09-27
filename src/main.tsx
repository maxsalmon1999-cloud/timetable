import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// fonts are bundled so the app looks right offline
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
