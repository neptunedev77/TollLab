import { Crosshair, Layers, Minus, Plus } from 'lucide-react'
import { IconButton } from '../ui/IconButton.tsx'

const UNAVAILABLE = 'disponível quando a rede estiver carregada'

export function MapControls() {
  return (
    <div
      role="toolbar"
      aria-label="Navegação do mapa"
      aria-orientation="vertical"
      className="flex flex-col gap-0.5 rounded-card border border-border bg-surface-raised p-1 shadow-float"
    >
      <IconButton label="Aproximar" icon={<Plus className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
      <IconButton label="Afastar" icon={<Minus className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
      <IconButton
        label="Recentrar mapa"
        icon={<Crosshair className="size-4" />}
        tooltipSide="left"
        unavailableReason={UNAVAILABLE}
      />
      <div aria-hidden="true" className="mx-1 my-0.5 h-px bg-border" />
      <IconButton label="Camadas" icon={<Layers className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
    </div>
  )
}
