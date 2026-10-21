import { Car, Coins, Info, Plus, RotateCcw, Save, Ticket } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'

const NO_NETWORK = 'Disponível quando a rede estiver carregada'

/** Estado "sem seleção" do painel lateral. Sem rede carregada, as métricas ficam vazias. */
export function OverviewPanel() {
  return (
    <div className="flex flex-col gap-5 p-5">
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="overview-title" className="text-lg font-extrabold tracking-tight">
            Visão geral
          </h2>
          <p className="text-xs text-muted">Seleciona uma portagem ou um troço no mapa para ver os detalhes.</p>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Portagens ativas" icon={<Ticket className="size-4" />} tone="sky" />
          <Metric label="Tráfego atual" icon={<Car className="size-4" />} tone="mint" />
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
          unavailableReason={NO_NETWORK}
          className="w-full"
        >
          Adicionar portagem
        </Button>
        <Button icon={<Save className="size-4" />} unavailableReason={NO_NETWORK} className="w-full">
          Guardar cenário
        </Button>
        <Button icon={<RotateCcw className="size-4" />} unavailableReason={NO_NETWORK} className="w-full">
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
