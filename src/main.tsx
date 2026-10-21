import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import { App } from './App.tsx'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root não encontrado em index.html')
}

// Galeria do design system só em desenvolvimento; em produção este ramo é eliminado do bundle.
const Root =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')
    ? lazy(() => import('./dev/Gallery.tsx'))
    : App

createRoot(rootElement).render(
  <StrictMode>
    <Suspense>
      <Root />
    </Suspense>
  </StrictMode>,
)
