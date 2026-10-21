import { Car, Coins, Info, Plus, RotateCcw, Save, Ticket } from 'lucide-react'
import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { summarizeNetwork } from '../../domain/summary.ts'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'

const TOLL_EDITING_UNAVAILABLE = 'A edição de portagens ainda não está disponível'
const SCENARIOS_UNAVAILABLE = 'Os cenários ainda não estão disponíveis'
const NOTHING_TO_RESET = 'Ainda não há alterações para repor'

interface OverviewPanelProps {
  networkLoad: NetworkLoadResult
}

/**
 * Estado "sem seleção" do painel lateral. As contagens vêm dos dados da rede; tráfego e receita
 * ficam vazios até haver simulação, em vez de mostrarem números inventados.
 */
export function OverviewPanel({ networkLoad }: OverviewPanelProps) {
  const summary = networkLoad.status === 'ready' ? summarizeNetwork(networkLoad.dataset) : null

  return (
    <div className="flex flex-col gap-5 p-5">
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="overview-title" className="text-lg font-extrabold tracking-tight">
            Visão geral
          </h2>
          <p className="text-xs text-muted">Seleciona uma cidade ou um troço no mapa para ver os detalhes.</p>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <Metric
            label="Portagens ativas"
            value={summary ? String(summary.activeTolls) : undefined}
            hint={summary ? `de ${summary.tolls} pórticos` : undefined}
            icon={<Ticket className="size-4" />}
            tone="sky"
          />
          <Metric label="Tráfego atual" hint="Sem simulação" icon={<Car className="size-4" />} tone="mint" />
          <div className="col-span-2">
            <Metric
              label="Receita bruta do período"
              hint="Receita antes de custos. Não é lucro."
              icon={<Coins className="size-4" />}
              tone="peach"
            />
          </div>
        </dl>
      </section>

      <section aria-labelledby="actions-title" className="flex flex-col gap-2">
        <h2 id="actions-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Ações
        </h2>
        <Button
          variant="primary"
          size="lg"
          icon={<Plus className="size-4" strokeWidth={2.6} />}
          unavailableReason={TOLL_EDITING_UNAVAILABLE}
          className="w-full"
        >
          Adicionar portagem
        </Button>
        <Button icon={<Save className="size-4" />} unavailableReason={SCENARIOS_UNAVAILABLE} className="w-full">
          Guardar cenário
        </Button>
        <Button icon={<RotateCcw className="size-4" />} unavailableReason={NOTHING_TO_RESET} className="w-full">
          Repor configuração
        </Button>
      </section>

      <p className="flex gap-2 rounded-card bg-surface-muted p-3 text-[0.6875rem] leading-relaxed text-muted">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-subtle" />
        Os valores apresentados são estimativas de um modelo de demonstração, não dados oficiais nem informação em
        tempo real.
      </p>
    </div>
  )
}
