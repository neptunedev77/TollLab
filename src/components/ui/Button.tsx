import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'
import { Tooltip } from './Tooltip.tsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  /**
   * Quando definido, o botão fica indisponível mas continua focável, e o motivo aparece num tooltip.
   * É preferível a `disabled`, que esconde o controlo da navegação por teclado sem explicar porquê.
   */
  unavailableReason?: string
}

const variantClasses: Record<ButtonVariant, { base: string; interactive: string }> = {
  primary: {
    base: 'bg-accent text-white shadow-key',
    interactive: 'hover:bg-accent-hover active:shadow-key-pressed',
  },
  secondary: {
    base: 'border border-border bg-surface-raised text-ink shadow-soft',
    interactive: 'hover:border-border-strong hover:bg-surface',
  },
  ghost: {
    base: 'text-ink',
    interactive: 'hover:bg-surface-muted',
  },
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
}

function buttonClasses(variant: ButtonVariant, size: ButtonSize, unavailable: boolean) {
  const { base, interactive } = variantClasses[variant]
  return cx(
    'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-[0.01em] select-none',
    'transition-[background-color,border-color,box-shadow,transform] duration-200 ease-spring',
    sizeClasses[size],
    base,
    unavailable
      ? 'cursor-not-allowed opacity-45 saturate-50'
      : cx(interactive, 'hover:-translate-y-px active:translate-y-0 active:scale-[0.97]'),
  )
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  unavailableReason,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const unavailable = unavailableReason !== undefined

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (unavailable) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  const button = (
    <button
      type={type}
      aria-disabled={unavailable || undefined}
      className={cx(buttonClasses(variant, size, unavailable), className)}
      onClick={handleClick}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )

  return unavailable ? <Tooltip content={unavailableReason}>{button}</Tooltip> : button
}
