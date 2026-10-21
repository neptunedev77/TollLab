import { ChevronRight } from 'lucide-react'
import { nodeName } from '../../domain/summary.ts'
import type { RoadNode } from '../../domain/types.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { Badge } from '../ui/Badge.tsx'
import { PanelHeader } from './PanelHeader.tsx'

/** Painel de um nó selecionado: lista as ligações, que selecionam o troço respetivo. */
export function NodePanel({ node }: { node: RoadNode }) {
  const dataset = useMapStore((state) => state.dataset)
  const showAlternatives = useMapStore((state) => state.layers.alternatives)
  const select = useMapStore((state) => state.select)
  const clearSelection = useMapStore((state) => state.clearSelection)

  const links = dataset.network.edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .filter((edge) => edge.roadClass === 'motorway' || showAlternatives)
    .sort((a, b) => (a.roadClass === b.roadClass ? a.ref.localeCompare(b.ref) : a.roadClass === 'motorway' ? -1 : 1))

  return (
    <div className="flex flex-col gap-5 p-5 motion-safe:animate-settle">
      <PanelHeader
        titleId="node-title"
        eyebrow={
          <Badge tone={node.kind === 'city' ? 'info' : 'neutral'}>
            {node.kind === 'city' ? 'Cidade' : 'Nó de ligação'}
          </Badge>
        }
        title={node.name}
        subtitle={
          node.kind === 'city'
            ? 'Origem e destino de tráfego na simulação.'
            : 'Ponto de ligação entre vias, sem tráfego próprio.'
        }
        onBack={clearSelection}
      />

      <section aria-labelledby="node-links-title" className="flex flex-col gap-2">
        <h3 id="node-links-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Ligações ({links.length})
        </h3>
        <ul className="flex flex-col gap-1.5">
          {links.map((edge) => {
            const other = edge.from === node.id ? edge.to : edge.from
            const tolls = dataset.tolls.filter((toll) => toll.edgeId === edge.id).length
            return (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: 'edge', id: edge.id })}
                  className="group flex w-full items-center gap-2.5 rounded-card bg-surface-muted px-3 py-2.5 text-left transition-[background-color,transform] duration-200 ease-spring hover:-translate-y-px hover:bg-surface-sunken/70"
                >
                  <Badge tone={edge.roadClass === 'motorway' ? 'info' : 'neutral'}>{edge.ref}</Badge>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-bold text-ink">{nodeName(dataset, other)}</span>
                    <span className="text-[0.6875rem] text-subtle">
                      {edge.baseTimeMin} min{tolls > 0 ? ` · ${tolls} ${tolls === 1 ? 'pórtico' : 'pórticos'}` : ''}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
