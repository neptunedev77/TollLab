import { Plus, Save } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '../components/ui/Badge.tsx'
import { Button } from '../components/ui/Button.tsx'
import { IconButton } from '../components/ui/IconButton.tsx'
import { Metric } from '../components/ui/Metric.tsx'
import { NumberField } from '../components/ui/NumberField.tsx'
import { Slider } from '../components/ui/Slider.tsx'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews.tsx'

/** Galeria do design system, só em desenvolvimento: abrir com `?gallery`. */
export default function Gallery() {
  const [tariff, setTariff] = useState(1.25)
  const [raw, setRaw] = useState('1.25')
  const parsed = Number(raw)
  const error =
    raw.trim() === '' || !Number.isFinite(parsed)
      ? 'Introduz um valor numérico.'
      : parsed < 0
        ? 'A tarifa não pode ser negativa.'
        : undefined

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-lg font-semibold">Design system · TollLab</h1>
        <p className="text-xs text-muted">Página interna de desenvolvimento. Não faz parte do build de produção.</p>
      </header>

      <Section title="Cores">
        <div className="grid grid-cols-4 gap-2">
          {[
            ['canvas', 'bg-canvas'],
            ['surface', 'bg-surface'],
            ['accent', 'bg-accent'],
            ['focus', 'bg-focus'],
            ['flow', 'bg-flow'],
            ['congestion', 'bg-congestion'],
            ['alert', 'bg-alert'],
            ['road-motorway', 'bg-road-motorway'],
          ].map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-10 rounded-control border border-border ${cls}`} />
              <span className="text-[0.6875rem] text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Plus className="size-4" />}>
            Primário
          </Button>
          <Button>Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button size="sm">Pequeno</Button>
          <Button icon={<Save className="size-4" />} unavailableReason="Exemplo de ação indisponível">
            Indisponível
          </Button>
          <IconButton label="Adicionar" icon={<Plus className="size-4" />} />
          <IconButton label="Ativo" icon={<Plus className="size-4" />} pressed />
        </div>
      </Section>

      <Section title="Campos e slider">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Tarifa (classe 1)"
            unit="€"
            min={0}
            step={0.05}
            value={raw}
            onChange={setRaw}
            error={error}
            hint="Valor por passagem."
          />
          <Slider
            label="Tarifa"
            min={0}
            max={5}
            step={0.05}
            value={tariff}
            onChange={setTariff}
            formatValue={(value) => `${value.toFixed(2)} €`}
          />
        </div>
      </Section>

      <Section title="Badges e métricas">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutro</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="flow">Fluido</Badge>
          <Badge tone="warning">Congestionado</Badge>
          <Badge tone="alert">Alerta</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Sem dados" />
          <Metric label="Exemplo formatado" value="1 234,50 €" hint="Valor ilustrativo da galeria" />
        </dl>
      </Section>

      <Section title="Estados">
        <div className="grid grid-cols-3 gap-4">
          <Frame>
            <EmptyState title="Sem resultados" description="Ainda não há nada para mostrar." />
          </Frame>
          <Frame>
            <LoadingState label="A carregar a rede…" />
          </Frame>
          <Frame>
            <ErrorState title="Falha ao carregar" description="Mensagem de erro." onRetry={() => undefined} />
          </Frame>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-card border border-border bg-surface p-4">
      {children}
    </div>
  )
}
