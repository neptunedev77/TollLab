interface MetricProps {
  label: string
  /** Valor já formatado. `undefined` significa que ainda não há dados. */
  value?: string
  hint?: string
}

/** Métrica do painel. Sem dados, mostra um travessão em vez de um número inventado. */
export function Metric({ label, value, hint }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control border border-border bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-ink">
        {value ?? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sem dados</span>
          </>
        )}
      </dd>
      {hint && <dd className="text-[0.6875rem] text-subtle">{hint}</dd>}
    </div>
  )
}
