import type { ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'

type BadgeTone = 'neutral' | 'info' | 'flow' | 'warning' | 'alert'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted border-border',
  info: 'bg-accent-soft text-accent border-transparent',
  flow: 'bg-flow-soft text-flow border-transparent',
  warning: 'bg-congestion-soft text-congestion border-transparent',
  alert: 'bg-alert-soft text-alert border-transparent',
}

interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
        toneClasses[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}
