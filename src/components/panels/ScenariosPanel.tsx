import { AlertTriangle, ArrowLeft, Copy, FolderOpen, Pencil, Save, Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { formatEuros } from '../../domain/money.ts'
import { compareScenarios, type MetricComparison } from '../../scenarios/compare.ts'
import { sameConfiguration, type Scenario } from '../../scenarios/scenario.ts'
import { MAX_SEED } from '../../store/mapStore.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { formatInteger, formatMinutes, formatPercent } from '../../utils/format.ts'
import { Badge } from '../ui/Badge.tsx'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { NumberField } from '../ui/NumberField.tsx'

const dateFormat = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

/** Painel de cenários: guardar a configuração atual, gerir os cenários guardados e comparar dois. */
export function ScenariosPanel() {
  const scenarios = useMapStore((state) => state.scenarios)
  const warnings = useMapStore((state) => state.scenarioWarnings)
  const dismissWarnings = useMapStore((state) => state.dismissScenarioWarnings)
  const setPanelView = useMapStore((state) => state.setPanelView)
  const [compare, setCompare] = useState<string[]>([])
  const selected = compare
    .map((id) => scenarios.find((scenario) => scenario.id === id))
    .filter((scenario): scenario is Scenario => scenario !== undefined)

  const toggleCompare = (id: string) =>
    setCompare((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-2),
    )

  return (
    <div className="flex flex-col gap-5 p-5 motion-safe:animate-settle">
      <div className="flex items-start gap-2">
        <IconButton
          label="Voltar ao mapa"
          icon={<ArrowLeft className="size-4" />}
          tooltipSide="bottom"
          onClick={() => setPanelView('map')}
          className="-ml-1.5 rounded-full"
        />
        <div className="flex flex-col gap-0.5 pt-1">
          <h2 className="text-lg leading-tight font-extrabold tracking-tight">Cenários</h2>
          <p className="text-xs text-muted">Guardados neste browser. Cada cenário é independente dos outros.</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-card bg-congestion-soft p-3 text-xs text-ink">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-congestion" />
          <ul className="flex flex-1 flex-col gap-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <IconButton label="Fechar avisos" icon={<X className="size-3.5" />} onClick={dismissWarnings} className="size-7 rounded-full" />
        </div>
      )}

      <CurrentConfiguration />

      <section aria-labelledby="saved-title" className="flex flex-col gap-2">
        <h3 id="saved-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Guardados ({scenarios.length})
        </h3>
        {scenarios.length === 0 ? (
          <p className="rounded-card bg-surface-muted p-3 text-xs text-muted">
            Ainda não há cenários. Guarda a configuração atual para a poderes comparar com outra.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scenarios.map((scenario) => (
              <ScenarioItem
                key={scenario.id}
                scenario={scenario}
                comparing={compare.indexOf(scenario.id)}
                onToggleCompare={() => toggleCompare(scenario.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {selected.length === 2 && selected[0] && selected[1] ? (
        <Comparison a={selected[0]} b={selected[1]} />
      ) : (
        scenarios.length >= 2 && (
          <p className="px-1 text-[0.6875rem] text-subtle">Marca dois cenários em “Comparar” para ver as diferenças.</p>
        )
      )}
    </div>
  )
}

function CurrentConfiguration() {
  const scenarios = useMapStore((state) => state.scenarios)
  const activeId = useMapStore((state) => state.activeScenarioId)
  const tolls = useMapStore((state) => state.tolls)
  const demand = useMapStore((state) => state.demand)
  const seed = useMapStore((state) => state.seed)
  const saveScenarioAs = useMapStore((state) => state.saveScenarioAs)
  const saveActiveScenario = useMapStore((state) => state.saveActiveScenario)
  const setSeed = useMapStore((state) => state.setSeed)
  const [name, setName] = useState('')
  const [seedDraft, setSeedDraft] = useState<string | null>(null)
  const nameId = useId()
  const active = scenarios.find((scenario) => scenario.id === activeId)
  const dirty = active ? !sameConfiguration(active, { tolls, demand, seed }) : true

  const seedText = seedDraft ?? String(seed)
  const seedValue = Number(seedText)
  const seedError =
    seedDraft === null
      ? undefined
      : !/^\d+$/.test(seedText.trim()) || !Number.isInteger(seedValue) || seedValue > MAX_SEED
        ? `Usa um número inteiro entre 0 e ${formatInteger(MAX_SEED)}.`
        : undefined

  return (
    <section aria-labelledby="current-title" className="flex flex-col gap-3 rounded-card bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="current-title" className="text-xs font-extrabold text-ink">
          Configuração atual
        </h3>
        <Badge tone={active ? (dirty ? 'warning' : 'flow') : 'neutral'}>
          {active ? (dirty ? 'Alterações por guardar' : 'Guardada') : 'Não guardada'}
        </Badge>
      </div>
      {active && <p className="-mt-2 text-[0.6875rem] text-muted">Baseada em “{active.name}”.</p>}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          saveScenarioAs(name)
          setName('')
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={nameId} className="text-xs font-bold text-muted">
            Nome do novo cenário
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={60}
            placeholder="Ex.: A3 mais cara"
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-control border-2 border-transparent bg-surface-raised px-3 text-sm font-semibold outline-none focus:border-accent"
          />
        </div>
        <Button type="submit" variant="primary" icon={<Save className="size-4" />}>
          Guardar
        </Button>
      </form>
      {active && (
        <Button
          icon={<Save className="size-4" />}
          onClick={saveActiveScenario}
          unavailableReason={dirty ? undefined : 'Não há alterações em relação ao cenário'}
          className="w-full"
        >
          Atualizar “{active.name}”
        </Button>
      )}

      <div
        onBlur={() => {
          if (seedDraft !== null && !seedError) setSeed(Number(seedDraft))
          setSeedDraft(null)
        }}
      >
        <NumberField
          label="Semente da simulação"
          type="text"
          inputMode="numeric"
          value={seedText}
          error={seedError}
          hint="Mesma semente e parâmetros → mesmos resultados. Aplica-se ao sair do campo."
          onChange={setSeedDraft}
        />
      </div>
    </section>
  )
}

function ScenarioItem({ scenario, comparing, onToggleCompare }: { scenario: Scenario; comparing: number; onToggleCompare: () => void }) {
  const activeId = useMapStore((state) => state.activeScenarioId)
  const loadScenario = useMapStore((state) => state.loadScenario)
  const duplicateScenario = useMapStore((state) => state.duplicateScenario)
  const renameScenario = useMapStore((state) => state.renameScenario)
  const deleteScenario = useMapStore((state) => state.deleteScenario)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(scenario.name)
  const compareId = useId()
  const { results } = scenario

  return (
    <li className={cx('flex flex-col gap-2 rounded-card bg-surface-muted p-3 ring-2', scenario.id === activeId ? 'ring-accent/50' : 'ring-transparent')}>
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              renameScenario(scenario.id, draft)
              setRenaming(false)
            }}
          >
            <input
              aria-label={`Novo nome para ${scenario.name}`}
              value={draft}
              maxLength={60}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- o campo aparece por ação explícita do utilizador
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setRenaming(false)
                  setDraft(scenario.name)
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-xl border-2 border-accent bg-surface-raised px-2 text-xs font-bold outline-none"
            />
            <Button type="submit" size="sm" variant="primary">
              OK
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-extrabold text-ink">{scenario.name}</span>
            <span className="text-[0.6875rem] text-subtle">
              {dateFormat.format(new Date(scenario.updatedAt))} · semente {scenario.seed}
              {scenario.id === activeId ? ' · carregado' : ''}
            </span>
          </div>
        )}
        <label htmlFor={compareId} className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[0.6875rem] font-bold text-muted">
          <input id={compareId} type="checkbox" checked={comparing >= 0} onChange={onToggleCompare} className="size-3.5 accent-[var(--color-accent)]" />
          Comparar{comparing >= 0 ? ` (${comparing === 0 ? 'A' : 'B'})` : ''}
        </label>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-[0.6875rem]">
        <Fact label="Receita bruta" value={formatEuros(results.grossCents)} />
        <Fact label="Líquido" value={formatEuros(results.netCents)} />
        <Fact label="Tempo médio" value={results.averageTimeMin === null ? '—' : formatMinutes(results.averageTimeMin)} />
      </dl>

      <div className="flex flex-wrap gap-1">
        <Button size="sm" icon={<FolderOpen className="size-3.5" />} onClick={() => loadScenario(scenario.id)}>
          Carregar
        </Button>
        <IconButton label={`Duplicar ${scenario.name}`} icon={<Copy className="size-3.5" />} onClick={() => duplicateScenario(scenario.id)} />
        <IconButton
          label={`Renomear ${scenario.name}`}
          icon={<Pencil className="size-3.5" />}
          onClick={() => {
            setDraft(scenario.name)
            setRenaming(true)
          }}
        />
        <IconButton
          label={`Apagar ${scenario.name}`}
          icon={<Trash2 className="size-3.5" />}
          onClick={() => deleteScenario(scenario.id)}
          className="text-alert hover:bg-alert-soft"
        />
      </div>
    </li>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface-raised px-2 py-1.5">
      <dt className="text-subtle">{label}</dt>
      <dd className="font-extrabold text-ink tabular-nums">{value}</dd>
    </div>
  )
}

function formatMetric(metric: MetricComparison, value: number | null): string {
  if (value === null) return '—'
  if (metric.unit === 'cents') return formatEuros(value)
  if (metric.unit === 'minutes') return formatMinutes(value)
  return formatInteger(value)
}

function formatDelta(metric: MetricComparison): string {
  if (metric.delta === null) return '—'
  const sign = metric.delta > 0 ? '+' : metric.delta < 0 ? '−' : '±'
  const magnitude = formatMetric(metric, Math.abs(metric.delta))
  const ratio = metric.deltaRatio === null ? '' : ` (${sign}${formatPercent(Math.abs(metric.deltaRatio))})`
  return `${sign}${magnitude}${ratio}`
}

function deltaTone(metric: MetricComparison): string {
  if (metric.delta === null || Math.abs(metric.delta) < 1e-9 || metric.better === 'neutral') return 'text-muted'
  const improved = metric.better === 'higher' ? metric.delta > 0 : metric.delta < 0
  return improved ? 'text-flow' : 'text-alert'
}

/** Tabela de comparação A → B, com avisos quando os cenários não são (totalmente) comparáveis. */
function Comparison({ a, b }: { a: Scenario; b: Scenario }) {
  const comparison = compareScenarios(a, b)

  return (
    <section aria-labelledby="comparison-title" className="flex flex-col gap-2">
      <h3 id="comparison-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
        Comparação: A “{a.name}” → B “{b.name}”
      </h3>
      {!comparison.comparable && (
        <div role="alert" className="rounded-card bg-alert-soft p-3 text-xs text-alert">
          <p className="font-extrabold">Estes cenários não são comparáveis.</p>
          {comparison.blockers.map((blocker) => (
            <p key={blocker}>{blocker}</p>
          ))}
        </div>
      )}
      {comparison.cautions.map((caution) => (
        <p key={caution} className="rounded-card bg-congestion-soft p-3 text-xs text-ink">
          {caution}
        </p>
      ))}
      <p className="px-1 text-[0.6875rem] text-subtle">
        {comparison.tollDifferences === 0
          ? 'Os pórticos e as tarifas são iguais nos dois cenários.'
          : `${comparison.tollDifferences} ${comparison.tollDifferences === 1 ? 'pórtico difere' : 'pórticos diferem'} entre os cenários.`}
      </p>
      <div className="overflow-hidden rounded-card ring-1 ring-border">
        <table className="w-full text-left text-[0.6875rem]">
          <thead className="bg-surface-muted text-subtle">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-bold">
                Métrica
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-bold">
                A
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-bold">
                B
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-bold">
                B − A
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.metrics.map((metric) => (
              <tr key={metric.key} className="border-t border-border">
                <th scope="row" className="px-2 py-1.5 font-semibold text-ink">
                  {metric.label}
                </th>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMetric(metric, metric.a)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMetric(metric, metric.b)}</td>
                <td className={cx('px-2 py-1.5 text-right font-bold tabular-nums', deltaTone(metric))}>{formatDelta(metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[0.6875rem] text-subtle">Resultados do motor de demonstração para uma hora de procura; não são previsões oficiais.</p>
    </section>
  )
}
