import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'
import { Tooltip } from './Tooltip.tsx'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Nome acessível; também é mostrado no tooltip. */
  label: string
  icon: ReactNode
  tooltipSide?: TooltipSide
  pressed?: boolean
  unavailableReason?: string
}

export function IconButton({
  label,
  icon,
  tooltipSide = 'top',
  pressed,
  unavailableReason,
  className,
  onClick,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const unavailable = unavailableReason !== undefined

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (unavailable) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <Tooltip content={unavailable ? `${label} — ${unavailableReason}` : label} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        aria-disabled={unavailable || undefined}
        className={cx(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink',
          'transition-colors duration-150 ease-calm hover:bg-surface-muted',
          pressed && 'bg-accent-soft text-accent',
          unavailable && 'cursor-not-allowed opacity-45 hover:bg-transparent',
          className,
        )}
        onClick={handleClick}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
