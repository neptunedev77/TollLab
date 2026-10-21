import { ArrowRight, Coins, Repeat, Route, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { centsToInput, formatEuros, parseEuroInput } from '../../domain/money.ts'
import { nodeName } from '../../domain/summary.ts'
import { VEHICLE_CLASSES, type TollPoint, type VehicleClass } from '../../domain/types.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { Badge } from '../ui/Badge.tsx'
import { Button } from '../ui/Button.tsx'
import { Metric } from '../ui/Metric.tsx'
import { NumberField } from '../ui/NumberField.tsx'
import { Slider } from '../ui/Slider.tsx'
import { Toggle } from '../ui/Toggle.tsx'
import { PanelHeader } from './PanelHeader.tsx'

/** Máximo do slider (10 €); o campo numérico aceita até ao limite do modelo (100 €). */
const SLIDER_MAX_CENTS = 1000

const CLASS_LABELS: Record<VehicleClass, { short: string; description: string }> = {
  c1: { short: 'Classe 1', description: 'Motociclos e veículos ligeiros' },
  c2: { short: 'Classe 2', description: 'Dois eixos, altura ao 1.º eixo ≥ 1,10 m' },
  c3: { short: 'Classe 3', description: 'Três eixos' },
  c4: { short: 'Classe 4', description: 'Quatro ou mais eixos' },
}

/** Painel de um pórtico selecionado: cobrança, tarifa por classe, posição no troço e remoção. */
export function TollPanel({ toll }: { toll: TollPoint }) {
  const dataset = useMapStore((state) => state.dataset)
  const select = useMapStore((state) => state.select)
  const clearSelection = useMapStore((state) => state.clearSelection)
  const setTollActive = useMapStore((state) => state.setTollActive)
  const moveToll = useMapStore((state) => state.moveToll)
  const removeToll = useMapStore((state) => state.removeToll)
  const edge = dataset.network.edges.find((candidate) => candidate.id === toll.edgeId)
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('c1')

  return (
    <div className="flex flex-col gap-5 p-5 motion-safe:animate-settle">
      <PanelHeader
        titleId="toll-title"
        eyebrow={
          <>
            <Badge tone={toll.active ? 'warning' : 'neutral'}>{toll.active ? 'Ativo' : 'Inativo'}</Badge>
            <span className="text-[0.6875rem] font-bold text-subtle">Pórtico selecionado</span>
          </>
        }
        title={toll.name}
        onBack={clearSelection}
      />

      {edge && (
        <button
          type="button"
          onClick={() => select({ kind: 'edge', id: edge.id })}
          className="group -mt-2 flex items-center gap-2.5 rounded-card bg-surface-muted px-3 py-2.5 text-left transition-[background-color,transform] duration-200 ease-spring hover:-translate-y-px hover:bg-surface-sunken/70"
        >
          <Route aria-hidden="true" className="size-4 shrink-0 text-subtle" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[0.6875rem] text-subtle">No troço</span>
            <span className="truncate text-xs font-bold text-ink">
              {edge.ref} · {nodeName(dataset, edge.from)} – {nodeName(dataset, edge.to)}
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      <div className="rounded-card bg-surface-muted px-1.5 py-1">
        <Toggle
          label="Cobrança ativa"
          checked={toll.active}
          onChange={(active) => setTollActive(toll.id, active)}
          hint={toll.active ? 'Os veículos que passam aqui pagam a tarifa.' : 'O pórtico existe mas não cobra.'}
        />
      </div>

      <section aria-labelledby="tariff-title" className="flex flex-col gap-3">
        <h3 id="tariff-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Tarifa por passagem
        </h3>
        <ClassPicker value={vehicleClass} onChange={setVehicleClass} />
        <p className="-mt-1 px-1 text-[0.6875rem] text-subtle">{CLASS_LABELS[vehicleClass].description}</p>
        <TariffEditor key={`${toll.id}:${vehicleClass}`} toll={toll} vehicleClass={vehicleClass} />
        <p className="px-1 text-[0.6875rem] text-subtle">
          {VEHICLE_CLASSES.map((c) => `${c.replace('c', 'C')}: ${formatEuros(toll.tariffCents[c])}`).join(' · ')}
        </p>
      </section>

      <section aria-labelledby="position-title" className="flex flex-col gap-2">
        <h3 id="position-title" className="px-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
          Posição
        </h3>
        <Slider
          label={`Posição no troço${edge ? ` (a partir de ${nodeName(dataset, edge.from)})` : ''}`}
          min={4}
          max={96}
          value={Math.round(toll.position * 100)}
          onChange={(value) => moveToll(toll.id, toll.edgeId, value / 100)}
          formatValue={(value) => `${value} %`}
        />
        <p className="px-1 text-[0.6875rem] text-subtle">
          Também podes arrastar o pórtico no mapa: encaixa na estrada mais próxima. Esc cancela o movimento.
        </p>
      </section>

      <section aria-label="Resultados do pórtico" className="flex flex-col gap-2">
        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Passagens" hint="Sem simulação" icon={<Repeat className="size-4" />} tone="sky" />
          <Metric label="Receita bruta" hint="Sem simulação" icon={<Coins className="size-4" />} tone="peach" />
          <div className="col-span-2">
            <Metric label="Tráfego que escolhe alternativas" hint="Sem simulação" icon={<Route className="size-4" />} tone="mint" />
          </div>
        </dl>
      </section>

      <Button
        icon={<Trash2 className="size-4" />}
        onClick={() => removeToll(toll.id)}
        className="w-full text-alert hover:border-alert/40 hover:bg-alert-soft"
      >
        Remover pórtico
      </Button>
    </div>
  )
}

function ClassPicker({ value, onChange }: { value: VehicleClass; onChange: (value: VehicleClass) => void }) {
  const name = useId()
  return (
    <fieldset className="grid grid-cols-4 gap-1 rounded-full bg-surface-muted p-1">
      <legend className="sr-only">Classe de veículo</legend>
      {VEHICLE_CLASSES.map((vehicleClass) => {
        const checked = vehicleClass === value
        return (
          <label
            key={vehicleClass}
            className={cx(
              'flex h-8 cursor-pointer items-center justify-center rounded-full text-xs font-extrabold transition-[background-color,color,box-shadow] duration-200',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus',
              checked ? 'bg-surface-raised text-ink shadow-soft' : 'text-subtle hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={vehicleClass}
              checked={checked}
              onChange={() => onChange(vehicleClass)}
              aria-label={CLASS_LABELS[vehicleClass].short}
              className="sr-only"
            />
            <span aria-hidden="true">{vehicleClass.replace('c', 'C')}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

/**
 * Editor de tarifa com slider (0–10 €) e campo em euros (até 100 €). O campo guarda o texto que o
 * utilizador escreve; cada valor válido é aplicado logo, e um valor inválido mostra o erro sem
 * alterar o modelo.
 */
function TariffEditor({ toll, vehicleClass }: { toll: TollPoint; vehicleClass: VehicleClass }) {
  const setTollTariff = useMapStore((state) => state.setTollTariff)
  const cents = toll.tariffCents[vehicleClass]
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? centsToInput(cents)
  const parsed = draft === null ? null : parseEuroInput(draft)
  const error = parsed && !parsed.ok ? parsed.message : undefined

  return (
    <div className="flex flex-col gap-3">
      <Slider
        label={`Tarifa (${CLASS_LABELS[vehicleClass].short})`}
        min={0}
        max={SLIDER_MAX_CENTS}
        step={5}
        value={Math.min(cents, SLIDER_MAX_CENTS)}
        onChange={(value) => {
          setDraft(null)
          setTollTariff(toll.id, vehicleClass, value)
        }}
        formatValue={(value) => (cents > SLIDER_MAX_CENTS ? `${formatEuros(cents)}` : formatEuros(value))}
      />
      <div
        onBlur={() => {
          // Ao sair do campo, mostra-se sempre o valor do modelo: um valor válido fica no formato normal
          // (ex.: "2" → "2,00") e um inválido é descartado, para o campo nunca contradizer o modelo.
          setDraft(null)
        }}
      >
        <NumberField
          label={`Valor exato (${CLASS_LABELS[vehicleClass].short})`}
          type="text"
          inputMode="decimal"
          unit="€"
          value={text}
          error={error}
          hint="Até 100 €, com no máximo duas casas decimais."
          onChange={(value) => {
            setDraft(value)
            const result = parseEuroInput(value)
            if (result.ok && result.cents !== cents) setTollTariff(toll.id, vehicleClass, result.cents)
          }}
        />
      </div>
    </div>
  )
}
