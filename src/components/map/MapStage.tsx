import { Map as MapIcon } from 'lucide-react'
import { EmptyState } from '../ui/StateViews.tsx'
import { MapControls } from './MapControls.tsx'
import { SchematicNotice } from './SchematicNotice.tsx'
import { SimulationControls } from '../simulation/SimulationControls.tsx'

/**
 * Área principal do mapa. Por agora é um placeholder: a rede esquemática e a navegação chegam
 * com o modelo de dados e o renderizador. Os controlos flutuantes ficam nos cantos para nunca
 * taparem o centro do mapa.
 */
export function MapStage() {
  return (
    <div className="map-grid relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyState
          icon={<MapIcon aria-hidden="true" className="size-8" strokeWidth={1.5} />}
          title="A rede ainda não foi carregada"
          description="A rede rodoviária esquemática de demonstração vai aparecer aqui."
        />
      </div>

      <div className="absolute top-3 right-3">
        <MapControls />
      </div>

      <div className="absolute top-3 left-3">
        <SchematicNotice />
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <SimulationControls />
      </div>
    </div>
  )
}
