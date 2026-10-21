import { Route } from 'lucide-react'
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
    <div className="map-paper relative h-full w-full">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyState
          icon={<Route aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="A rede ainda não foi carregada"
          description="A rede rodoviária esquemática de demonstração vai aparecer aqui."
        />
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
