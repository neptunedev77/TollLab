import { useId, useState } from 'react'
import { TopBar } from './components/layout/TopBar.tsx'
import { MapStage } from './components/map/MapStage.tsx'
import { SidePanel } from './components/panels/SidePanel.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'

export function App() {
  const panelId = useId()
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <TopBar panelOpen={panelOpen} panelId={panelId} onTogglePanel={() => setPanelOpen((open) => !open)} />
      <div className="flex min-h-0">
        <main aria-label="Mapa da rede" className="relative min-w-0 flex-1">
          <ErrorBoundary title="O mapa não pôde ser apresentado">
            <MapStage />
          </ErrorBoundary>
        </main>
        <ErrorBoundary title="O painel lateral não pôde ser apresentado">
          <SidePanel id={panelId} open={panelOpen} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
