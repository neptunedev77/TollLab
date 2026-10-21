import { useId } from 'react'
import { cx } from '../../utils/cx.ts'

interface NumberFieldProps {
  label: string
  /** Texto bruto do campo, para não perder o que o utilizador está a escrever. */
  value: string
  onChange: (value: string) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  error?: string
  hint?: string
}

export function NumberField({ label, value, onChange, unit, min, max, step, error, hint }: NumberFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={cx(
          'flex h-9 items-center rounded-control border bg-surface px-2.5 transition-colors duration-150',
          'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus',
          error ? 'border-alert' : 'border-border-strong',
        )}
      >
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-sm tabular-nums text-ink outline-none"
        />
        {unit && <span className="ml-1.5 text-xs text-subtle">{unit}</span>}
      </div>
      {message && (
        <p id={messageId} className={cx('text-xs', error ? 'text-alert' : 'text-subtle')}>
          {message}
        </p>
      )}
    </div>
  )
}
