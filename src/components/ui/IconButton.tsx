import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'
import type { TooltipSide } from '../../utils/tooltipPosition.ts'
import { Tooltip } from './Tooltip.tsx'

type IconButtonVariant = 'ghost' | 'primary'
type IconButtonSize = 'md' | 'lg'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Nome acessível; também é mostrado no tooltip. */
  label: string
  icon: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
  tooltipSide?: TooltipSide
  pressed?: boolean
  unavailableReason?: string
}

const sizeClasses: Record<IconButtonSize, string> = {
  md: 'size-9 rounded-control',
  lg: 'size-11 rounded-full',
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
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
          'inline-flex shrink-0 items-center justify-center',
          'transition-[background-color,color,box-shadow,transform] duration-200 ease-spring',
          sizeClasses[size],
          variant === 'primary' ? 'bg-accent text-white shadow-key' : 'text-ink',
          pressed && 'bg-accent-soft text-accent',
          unavailable
            ? 'cursor-not-allowed opacity-40'
            : cx(
                variant === 'primary' ? 'hover:bg-accent-hover active:shadow-key-pressed' : 'hover:bg-surface-muted',
                'hover:scale-[1.06] active:scale-[0.94]',
              ),
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
