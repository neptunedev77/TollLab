import { Info } from 'lucide-react'

/** Aviso permanente sobre a natureza do mapa: posições reais, traçado aproximado, não oficial. */
export function SchematicNotice() {
  return (
    <p className="flex items-center gap-1.5 rounded-full bg-surface-raised/90 py-1.5 pr-3 pl-2 text-[0.6875rem] font-semibold text-muted shadow-soft ring-1 ring-border/70 backdrop-blur-md">
      <Info aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
      Cidades em posições reais · traçado das estradas aproximado · não é cartografia oficial
    </p>
  )
}
