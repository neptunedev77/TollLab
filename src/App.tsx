import { useId, useState, type ReactNode } from 'react'
import { TopBar } from './components/layout/TopBar.tsx'
import { MapStage } from './components/map/MapStage.tsx'
import { SidePanel } from './components/panels/SidePanel.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { loadNetwork } from './data/loadNetwork.ts'
import type { MapStoreOptions } from './store/mapStore.ts'
import { MapStoreProvider } from './store/MapStoreProvider.tsx'

interface AppProps {
  /** Opções do store do mapa (ex.: desligar animações em testes). */
  mapStoreOptions?: MapStoreOptions
}

export function App({ mapStoreOptions }: AppProps = {}) {
  const panelId = useId()
  const [panelOpen, setPanelOpen] = useState(true)
  // Validada uma vez no arranque; nunca chega à interface uma rede inválida.
  const [networkLoad] = useState(() => loadNetwork())

  const workspace = (
    <div className="flex min-h-0 flex-1">
      <main
        aria-label="Mapa da rede"
        className="relative min-w-0 flex-1 overflow-hidden rounded-island bg-sea shadow-island ring-1 ring-border/80"
      >
        <ErrorBoundary title="O mapa não pôde ser apresentado">
          <MapStage networkLoad={networkLoad} />
        </ErrorBoundary>
      </main>
      <ErrorBoundary title="O painel lateral não pôde ser apresentado">
        <SidePanel id={panelId} open={panelOpen} networkLoad={networkLoad} />
      </ErrorBoundary>
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-[var(--island-gap)] overflow-hidden p-[var(--island-gap)] pt-0">
      <TopBar panelOpen={panelOpen} panelId={panelId} onTogglePanel={() => setPanelOpen((open) => !open)} />
      <WithMapStore networkLoad={networkLoad} options={mapStoreOptions}>
        {workspace}
      </WithMapStore>
    </div>
  )
}

/** Só há store do mapa quando a rede é válida; com rede inválida a interface mostra o erro. */
function WithMapStore({
  networkLoad,
  options,
  children,
}: {
  networkLoad: ReturnType<typeof loadNetwork>
  options: MapStoreOptions | undefined
  children: ReactNode
}) {
  if (networkLoad.status !== 'ready') return children
  return (
    <MapStoreProvider dataset={networkLoad.dataset} options={options}>
      {children}
    </MapStoreProvider>
  )
}
