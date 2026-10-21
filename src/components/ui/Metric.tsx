import type { ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'

type MetricTone = 'sky' | 'mint' | 'peach'

const toneClasses: Record<MetricTone, string> = {
  sky: 'bg-sky-soft text-accent',
  mint: 'bg-mint-soft text-flow',
  peach: 'bg-peach-soft text-congestion',
}

interface MetricProps {
  label: string
  /** Valor já formatado. `undefined` significa que ainda não há dados. */
  value?: string
  hint?: string
  icon?: ReactNode
  tone?: MetricTone
}

/** Métrica do painel. Sem dados, mostra um travessão em vez de um número inventado. */
export function Metric({ label, value, hint, icon, tone = 'sky' }: MetricProps) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-card bg-surface-muted p-3 transition-colors duration-200 hover:bg-surface-sunken/60">
      {icon && (
        <span
          aria-hidden="true"
          className={cx('flex size-7 shrink-0 items-center justify-center rounded-[0.6rem]', toneClasses[tone])}
        >
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-[0.6875rem] leading-tight font-bold text-muted">{label}</dt>
        <dd className="text-xl leading-tight font-extrabold tabular-nums text-ink">
          {value ?? (
            <>
              <span aria-hidden="true" className="text-subtle">
                —
              </span>
              <span className="sr-only">Sem dados</span>
            </>
          )}
        </dd>
        {hint && <dd className="mt-0.5 text-[0.6875rem] leading-snug text-subtle">{hint}</dd>}
      </div>
    </div>
  )
}
