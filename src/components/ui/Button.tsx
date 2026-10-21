import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'
import { Tooltip } from './Tooltip.tsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

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

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3 text-sm',
}

function buttonClasses(variant: ButtonVariant, size: ButtonSize, unavailable: boolean) {
  return cx(
    'inline-flex shrink-0 items-center justify-center rounded-control font-medium select-none',
    'transition-colors duration-150 ease-calm',
    sizeClasses[size],
    variantClasses[variant],
    unavailable && 'cursor-not-allowed opacity-50 hover:bg-[unset]',
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
