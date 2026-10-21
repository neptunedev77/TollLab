import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { ErrorState } from '../ui/StateViews.tsx'
import { MapControls } from './MapControls.tsx'
import { MapLegend } from './MapLegend.tsx'
import { MapViewport } from './MapViewport.tsx'
import { SchematicNotice } from './SchematicNotice.tsx'
import { SimulationControls } from '../simulation/SimulationControls.tsx'

interface MapStageProps {
  networkLoad: NetworkLoadResult
}

/**
 * Área principal do mapa. Com a rede válida mostra o mapa interativo; caso contrário, um estado de
 * erro. Os controlos flutuantes ficam nos cantos (fora da superfície de pan) para não taparem a rede.
 */
export function MapStage({ networkLoad }: MapStageProps) {
  if (networkLoad.status === 'invalid') {
    const [first] = networkLoad.issues
    const count = networkLoad.issues.length
    return (
      <div className="map-paper relative flex h-full w-full items-center justify-center p-6">
        <ErrorState
          title="A rede de demonstração tem dados inválidos"
          description={`${count} ${count === 1 ? 'problema encontrado' : 'problemas encontrados'}${first ? `: ${first.message}` : '.'}`}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-map">
      <MapViewport />

      <div className="absolute top-4 left-4">
        <SchematicNotice />
      </div>

      <div className="absolute top-4 right-4">
        <MapControls />
      </div>

      <div className="absolute bottom-4 left-4">
        <MapLegend />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <SimulationControls />
      </div>
    </div>
  )
}
