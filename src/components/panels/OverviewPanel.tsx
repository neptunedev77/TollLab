import { Plus, RotateCcw, Save } from 'lucide-react'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'

const NO_NETWORK = 'Disponível quando a rede estiver carregada'

/** Estado "sem seleção" do painel lateral. Sem rede carregada, as métricas ficam vazias. */
export function OverviewPanel() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <section aria-labelledby="overview-title" className="flex flex-col gap-3">
        <div>
          <h2 id="overview-title" className="text-sm font-semibold">
            Visão geral
          </h2>
          <p className="text-xs text-muted">Seleciona uma portagem ou um troço no mapa para ver os detalhes.</p>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Portagens ativas" />
          <Metric label="Tráfego atual" />
          <div className="col-span-2">
            <Metric label="Receita bruta do período" hint="Receita antes de custos. Não é lucro." />
          </div>
        </dl>
      </section>

      <section aria-labelledby="actions-title" className="flex flex-col gap-2">
        <h2 id="actions-title" className="text-xs font-semibold tracking-wide text-muted uppercase">
          Ações
        </h2>
        <Button variant="primary" icon={<Plus className="size-4" />} unavailableReason={NO_NETWORK} className="w-full">
          Adicionar portagem
        </Button>
        <Button icon={<Save className="size-4" />} unavailableReason={NO_NETWORK} className="w-full">
          Guardar cenário
        </Button>
        <Button icon={<RotateCcw className="size-4" />} unavailableReason={NO_NETWORK} className="w-full">
          Repor configuração
        </Button>
      </section>

      <p className="border-t border-border pt-3 text-[0.6875rem] leading-relaxed text-subtle">
        Os valores apresentados são estimativas de um modelo de demonstração, não dados oficiais nem informação
        em tempo real.
      </p>
    </div>
  )
}
