import { Info } from 'lucide-react'

/** Aviso permanente de que o mapa é esquemático e não cartográfico. */
export function SchematicNotice() {
  return (
    <p className="flex items-center gap-1.5 rounded-control border border-border bg-surface-raised/90 px-2.5 py-1.5 text-[0.6875rem] text-muted shadow-float backdrop-blur-sm">
      <Info aria-hidden="true" className="size-3.5 shrink-0" />
      Mapa esquemático inspirado no Norte de Portugal · não cartográfico
    </p>
  )
}
