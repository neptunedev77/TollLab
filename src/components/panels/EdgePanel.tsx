import { Clock, Gauge, Plus, Ruler } from 'lucide-react'
import { formatEuros } from '../../domain/money.ts'
import { nodeName } from '../../domain/summary.ts'
import type { RoadEdge } from '../../domain/types.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { Badge } from '../ui/Badge.tsx'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'
import { PanelHeader } from './PanelHeader.tsx'

const numberFormat = new Intl.NumberFormat('pt-PT')

/** Painel de um troço selecionado: identificação, valores base e portagens associadas. */
export function EdgePanel({ edge }: { edge: RoadEdge }) {
  const dataset = useMapStore((state) => state.dataset)
  const clearSelection = useMapStore((state) => state.clearSelection)
  const tolls = dataset.tolls.filter((toll) => toll.edgeId === edge.id)
  const motorway = edge.roadClass === 'motorway'
  const illustrative = dataset.illustrativeValues ? ' · ilustrativo' : ''

  return (
    <div className="flex flex-col gap-5 p-5 motion-safe:animate-settle">
      <PanelHeader
        titleId="edge-title"
        eyebrow={
          <>
            <Badge tone={motorway ? 'info' : 'neutral'}>{edge.ref}</Badge>
            <span className="text-[0.6875rem] font-bold text-subtle">Troço selecionado</span>
          </>
        }
        title={`${nodeName(dataset, edge.from)} – ${nodeName(dataset, edge.to)}`}
        subtitle={`${motorway ? 'Autoestrada' : 'Via alternativa'} · ${edge.oneWay ? 'sentido único' : 'dois sentidos'}`}
        onBack={clearSelection}
      />

      <section aria-labelledby="edge-title" className="flex flex-col gap-2">
        <dl className="grid grid-cols-2 gap-2">
          <Metric
            label="Tempo base"
            value={`${numberFormat.format(edge.baseTimeMin)} min`}
            hint={`Fluxo livre${illustrative}`}
            icon={<Clock className="size-4" />}
            tone="sky"
          />
          <Metric
            label="Capacidade"
            value={numberFormat.format(edge.capacityVehPerHour)}
            hint={`veíc./h por sentido${illustrative}`}
            icon={<Gauge className="size-4" />}
            tone="mint"
          />
          <div className="col-span-2">
            <Metric
              label="Comprimento"
              value={edge.lengthKm === null ? 'Desconhecido' : `${numberFormat.format(edge.lengthKm)} km`}
              hint={edge.lengthKm === null ? 'Sem fonte validada; o mapa é esquemático.' : undefined}
              icon={<Ruler className="size-4" />}
              tone="peach"
            />
          </div>
          <Metric label="Tráfego estimado" hint="Sem simulação" />
          <Metric label="Tempo estimado" hint="Sem simulação" />
        </dl>
      </section>

      <section aria-labelledby="edge-tolls-title" className="flex flex-col gap-2">
        <h3 id="edge-tolls-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Portagens neste troço
        </h3>
        {tolls.length === 0 ? (
          <p className="rounded-card bg-surface-muted p-3 text-xs text-muted">Sem portagens neste troço.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tolls.map((toll) => (
              <li key={toll.id} className="flex items-center justify-between gap-2 rounded-card bg-surface-muted px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-bold text-ink">{toll.name}</span>
                  <span className="text-[0.6875rem] text-subtle">Classe 1: {formatEuros(toll.tariffCents.c1)}</span>
                </div>
                <Badge tone={toll.active ? 'warning' : 'neutral'}>{toll.active ? 'Ativa' : 'Inativa'}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Button
          icon={<Plus className="size-4" />}
          unavailableReason="A edição de portagens ainda não está disponível"
          className="w-full"
        >
          Adicionar portagem neste troço
        </Button>
      </section>
    </div>
  )
}
