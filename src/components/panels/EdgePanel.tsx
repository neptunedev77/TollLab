import { Clock, Gauge, Plus, Ruler } from 'lucide-react'
import { formatEuros } from '../../domain/money.ts'
import { nodeName } from '../../domain/summary.ts'
import type { RoadEdge } from '../../domain/types.ts'
import { edgeLoad } from '../../simulation/assignment.ts'
import { useAssignment } from '../../store/useAssignment.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { formatInteger, formatMinutes, formatPercent } from '../../utils/format.ts'
import { Badge } from '../ui/Badge.tsx'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'
import { PanelHeader } from './PanelHeader.tsx'

const numberFormat = new Intl.NumberFormat('pt-PT')

/** Painel de um troço selecionado: identificação, valores base e portagens associadas. */
export function EdgePanel({ edge }: { edge: RoadEdge }) {
  const dataset = useMapStore((state) => state.dataset)
  const allTolls = useMapStore((state) => state.tolls)
  const tollsVisible = useMapStore((state) => state.layers.tolls)
  const clearSelection = useMapStore((state) => state.clearSelection)
  const select = useMapStore((state) => state.select)
  const addToll = useMapStore((state) => state.addToll)
  const tolls = allTolls.filter((toll) => toll.edgeId === edge.id).sort((a, b) => a.position - b.position)
  const motorway = edge.roadClass === 'motorway'
  const illustrative = dataset.illustrativeValues ? ' · ilustrativo' : ''
  const assignment = useAssignment()
  const volume = assignment?.edgeVolumes.get(edge.id)
  const directional = assignment ? [...assignment.flows.values()].filter((flow) => flow.edgeId === edge.id) : []
  const busiest = directional.reduce<(typeof directional)[number] | undefined>(
    (worst, flow) => (!worst || flow.volume > worst.volume ? flow : worst),
    undefined,
  )

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
              hint={edge.lengthKm === null ? 'Sem fonte validada; o traçado no mapa é aproximado.' : undefined}
              icon={<Ruler className="size-4" />}
              tone="peach"
            />
          </div>
          <Metric
            label="Tráfego estimado"
            value={volume === undefined ? undefined : formatInteger(volume)}
            hint={
              assignment
                ? `veíc./h, dois sentidos · ${formatPercent(edgeLoad(assignment, edge.id))} da capacidade no sentido mais carregado`
                : 'Sem simulação'
            }
          />
          <Metric
            label="Tempo estimado"
            value={busiest ? formatMinutes(busiest.timeMin) : undefined}
            hint={busiest ? 'Com congestionamento, no sentido mais carregado' : 'Sem simulação'}
          />
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
              <li key={toll.id}>
                <button
                  type="button"
                  disabled={!tollsVisible}
                  onClick={() => select({ kind: 'toll', id: toll.id })}
                  className="flex w-full items-center justify-between gap-2 rounded-card bg-surface-muted px-3 py-2.5 text-left transition-[background-color,transform] duration-200 ease-spring enabled:hover:-translate-y-px enabled:hover:bg-surface-sunken/70"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-bold text-ink">{toll.name}</span>
                    <span className="text-[0.6875rem] text-subtle">
                      Classe 1: {formatEuros(toll.tariffCents.c1)} · {Math.round(toll.position * 100)} % do troço
                    </span>
                  </span>
                  <Badge tone={toll.active ? 'warning' : 'neutral'}>{toll.active ? 'Ativa' : 'Inativa'}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button icon={<Plus className="size-4" />} onClick={() => addToll(edge.id)} className="w-full">
          Adicionar portagem neste troço
        </Button>
      </section>
    </div>
  )
}
