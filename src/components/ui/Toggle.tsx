import { useId } from 'react'
import { cx } from '../../utils/cx.ts'

interface ToggleProps {
  label: string
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  /** Nota curta visível (ex.: porque está indisponível). */
  hint?: string
}

/** Interruptor acessível: um checkbox nativo com aspeto de "pastilha" deslizante. */
export function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const labelId = `${id}-label`

  return (
    <label
      htmlFor={id}
      className={cx(
        'flex items-center justify-between gap-3 rounded-xl px-1.5 py-1.5 transition-colors duration-150',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-surface-muted',
      )}
    >
      <span className="flex flex-col">
        <span id={labelId} className="text-xs font-bold text-ink">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="text-[0.625rem] text-subtle">
            {hint}
          </span>
        )}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        // O nome é só o rótulo; a nota (se houver) é descrição, não parte do nome.
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange?.(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
          checked ? 'bg-accent' : 'bg-surface-sunken',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-soft transition-transform duration-200 ease-spring',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </label>
  )
}
