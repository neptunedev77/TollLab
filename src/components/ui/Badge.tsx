import type { ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'

type BadgeTone = 'neutral' | 'info' | 'flow' | 'warning' | 'alert'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted',
  info: 'bg-accent-soft text-accent-deep',
  flow: 'bg-flow-soft text-flow',
  warning: 'bg-congestion-soft text-congestion',
  alert: 'bg-alert-soft text-alert',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] leading-none font-bold whitespace-nowrap',
        toneClasses[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}
