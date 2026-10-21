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
  /** `text` permite vírgula decimal (ex.: "1,85"), que `number` não aceita em todos os browsers. */
  type?: 'number' | 'text'
  inputMode?: 'decimal' | 'numeric'
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  error,
  hint,
  type = 'number',
  inputMode = 'decimal',
}: NumberFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-muted">
        {label}
      </label>
      <div
        className={cx(
          'flex h-10 items-center rounded-control border-2 bg-surface-muted px-3',
          'transition-[border-color,background-color,box-shadow] duration-200 ease-calm',
          'focus-within:bg-surface-raised focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)]',
          error
            ? 'border-alert/70 focus-within:border-alert'
            : 'border-transparent hover:border-border focus-within:border-accent',
        )}
      >
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-ink outline-none"
        />
        {unit && <span className="ml-1.5 text-xs font-bold text-subtle">{unit}</span>}
      </div>
      {message && (
        <p
          id={messageId}
          className={cx('text-xs', error ? 'font-semibold text-alert motion-safe:animate-fade-up' : 'text-subtle')}
        >
          {message}
        </p>
      )}
    </div>
  )
}
