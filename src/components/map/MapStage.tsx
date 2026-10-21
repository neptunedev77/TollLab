import { Route } from 'lucide-react'
import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { summarizeNetwork } from '../../domain/summary.ts'
import { EmptyState, ErrorState } from '../ui/StateViews.tsx'
import { MapControls } from './MapControls.tsx'
import { SchematicNotice } from './SchematicNotice.tsx'
import { SimulationControls } from '../simulation/SimulationControls.tsx'

interface MapStageProps {
  networkLoad: NetworkLoadResult
}

/**
 * Área principal do mapa. A rede já é carregada e validada; o desenho do mapa chega com o
 * renderizador. Os controlos flutuantes ficam nos cantos para nunca taparem o centro do mapa.
 */
export function MapStage({ networkLoad }: MapStageProps) {
  return (
    <div className="map-paper relative h-full w-full">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <NetworkStatus networkLoad={networkLoad} />
      </div>

      <div className="absolute top-4 left-4">
        <SchematicNotice />
      </div>

      <div className="absolute top-4 right-4">
        <MapControls />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <SimulationControls />
      </div>
    </div>
  )
}

function NetworkStatus({ networkLoad }: MapStageProps) {
  if (networkLoad.status === 'invalid') {
    const [first] = networkLoad.issues
    const count = networkLoad.issues.length
    return (
      <ErrorState
        title="A rede de demonstração tem dados inválidos"
        description={`${count} ${count === 1 ? 'problema encontrado' : 'problemas encontrados'}${first ? `: ${first.message}` : '.'}`}
      />
    )
  }

  const summary = summarizeNetwork(networkLoad.dataset)
  return (
    <EmptyState
      icon={<Route aria-hidden="true" className="size-7" strokeWidth={2} />}
      title="Rede de demonstração carregada"
      description={`${summary.cities} cidades · ${summary.edges} troços · ${summary.tolls} pórticos. A visualização do mapa está em preparação.`}
    />
  )
}
