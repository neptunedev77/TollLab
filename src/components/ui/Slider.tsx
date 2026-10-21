import { useId } from 'react'

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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
        <output htmlFor={id} className="text-xs font-medium tabular-nums text-ink">
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
        className="h-1.5 w-full cursor-pointer"
      />
    </div>
  )
}
