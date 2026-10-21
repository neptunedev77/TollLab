import { Crosshair, Layers, Minus, Plus } from 'lucide-react'
import { IconButton } from '../ui/IconButton.tsx'

const UNAVAILABLE = 'disponível quando a rede estiver visível no mapa'

export function MapControls() {
  return (
    <div
      role="toolbar"
      aria-label="Navegação do mapa"
      aria-orientation="vertical"
      className="flex flex-col gap-1 rounded-[1.25rem] bg-surface-raised/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md"
    >
      <IconButton label="Aproximar" icon={<Plus className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
      <IconButton label="Afastar" icon={<Minus className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
      <IconButton
        label="Recentrar mapa"
        icon={<Crosshair className="size-4" />}
        tooltipSide="left"
        unavailableReason={UNAVAILABLE}
      />
      <div aria-hidden="true" className="mx-2 h-px bg-border" />
      <IconButton label="Camadas" icon={<Layers className="size-4" />} tooltipSide="left" unavailableReason={UNAVAILABLE} />
    </div>
  )
}
