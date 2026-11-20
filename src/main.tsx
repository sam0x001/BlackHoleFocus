import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable fonts — bundled by Vite, so they load offline and inside
// the packaged Windows app (no CDN, no CSP allowlist).
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
