import { Info } from 'lucide-react'

/** Aviso permanente de que o mapa é esquemático e não cartográfico. */
export function SchematicNotice() {
  return (
    <p className="flex items-center gap-1.5 rounded-full bg-surface-raised/90 py-1.5 pr-3 pl-2 text-[0.6875rem] font-semibold text-muted shadow-soft ring-1 ring-border/70 backdrop-blur-md">
      <Info aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
      Mapa esquemático inspirado no Norte de Portugal · não cartográfico
    </p>
  )
}
