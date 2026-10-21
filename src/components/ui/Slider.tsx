import { useId, type CSSProperties } from 'react'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  formatValue?: (value: number) => string
}

/** Slider nativo (acessível por teclado e leitores de ecrã) com o valor atual visível. */
export function Slider({ label, value, onChange, min, max, step = 1, formatValue = String }: SliderProps) {
  const id = useId()
  const formatted = formatValue(value)
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-bold text-muted">
          {label}
        </label>
        <output
          htmlFor={id}
          className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold tabular-nums text-accent-deep"
        >
          {formatted}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={formatted}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        className="tl-range w-full"
      />
    </div>
  )
}
