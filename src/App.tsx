import { useId, useState } from 'react'
import { TopBar } from './components/layout/TopBar.tsx'
import { MapStage } from './components/map/MapStage.tsx'
import { SidePanel } from './components/panels/SidePanel.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { loadNetwork } from './data/loadNetwork.ts'

export function App() {
  const panelId = useId()
  const [panelOpen, setPanelOpen] = useState(true)
  // Validada uma vez no arranque; nunca chega à interface uma rede inválida.
  const [networkLoad] = useState(() => loadNetwork())

  return (
    <div className="flex h-full flex-col gap-[var(--island-gap)] overflow-hidden p-[var(--island-gap)] pt-0">
      <TopBar panelOpen={panelOpen} panelId={panelId} onTogglePanel={() => setPanelOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1">
        <main
          aria-label="Mapa da rede"
          className="relative min-w-0 flex-1 overflow-hidden rounded-island bg-map shadow-island ring-1 ring-border/80"
        >
          <ErrorBoundary title="O mapa não pôde ser apresentado">
            <MapStage networkLoad={networkLoad} />
          </ErrorBoundary>
        </main>
        <ErrorBoundary title="O painel lateral não pôde ser apresentado">
          <SidePanel id={panelId} open={panelOpen} networkLoad={networkLoad} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
