import { Layers2 } from 'lucide-react'
import { sameConfiguration } from '../../scenarios/scenario.ts'
import { useMapStore } from '../../store/useMapStore.ts'

/** Nome do cenário carregado (ou "não guardado") na barra superior; abre o painel de cenários. */
export function ScenarioChip({ onOpen }: { onOpen: () => void }) {
  const scenarios = useMapStore((state) => state.scenarios)
  const activeId = useMapStore((state) => state.activeScenarioId)
  const tolls = useMapStore((state) => state.tolls)
  const demand = useMapStore((state) => state.demand)
  const seed = useMapStore((state) => state.seed)
  const setPanelView = useMapStore((state) => state.setPanelView)
  const active = scenarios.find((scenario) => scenario.id === activeId)
  const dirty = active !== undefined && !sameConfiguration(active, { tolls, demand, seed })

  return (
    <button
      type="button"
      onClick={() => {
        setPanelView('scenarios')
        onOpen()
      }}
      className="flex min-w-0 items-center gap-1.5 truncate rounded-full bg-surface-raised/80 px-3 py-1.5 text-xs font-bold text-muted shadow-soft transition-[background-color,transform] duration-200 ease-spring hover:-translate-y-px hover:bg-surface-raised"
    >
      <Layers2 aria-hidden="true" className="size-3.5 shrink-0 text-subtle" />
      <span className="sr-only">Cenário atual: </span>
      <span className="truncate">{active ? active.name : 'Cenário não guardado'}</span>
      {dirty && (
        <>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-congestion" />
          <span className="sr-only">(com alterações por guardar)</span>
        </>
      )}
      <span className="sr-only">. Abrir cenários.</span>
    </button>
  )
}
