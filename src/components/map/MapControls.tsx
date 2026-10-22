import { Crosshair, Layers, Minus, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { MapLayer } from '../../store/mapStore.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Toggle } from '../ui/Toggle.tsx'
import { ZOOM_STEP } from './MapViewport.tsx'

const LAYER_OPTIONS: ReadonlyArray<{ layer: MapLayer; label: string }> = [
  { layer: 'labels', label: 'Nomes das cidades' },
  { layer: 'tolls', label: 'Pórticos' },
  { layer: 'alternatives', label: 'Vias alternativas' },
  { layer: 'traffic', label: 'Tráfego (volume/capacidade)' },
]

/** Camadas que dependem de resultados da simulação; visíveis, mas indisponíveis por agora. */
const SIMULATION_LAYERS = ['Preço', 'Receita'] as const

export function MapControls() {
  const zoomBy = useMapStore((state) => state.zoomBy)
  const recenter = useMapStore((state) => state.recenter)

  return (
    <div
      role="toolbar"
      aria-label="Navegação do mapa"
      aria-orientation="vertical"
      className="flex flex-col gap-1 rounded-[1.25rem] bg-surface-raised/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md"
    >
      <IconButton label="Aproximar" icon={<Plus className="size-4" />} tooltipSide="left" onClick={() => zoomBy(ZOOM_STEP)} />
      <IconButton
        label="Afastar"
        icon={<Minus className="size-4" />}
        tooltipSide="left"
        onClick={() => zoomBy(1 / ZOOM_STEP)}
      />
      <IconButton label="Recentrar mapa" icon={<Crosshair className="size-4" />} tooltipSide="left" onClick={recenter} />
      <div aria-hidden="true" className="mx-2 h-px bg-border" />
      <LayersMenu />
    </div>
  )
}

function LayersMenu() {
  const layers = useMapStore((state) => state.layers)
  const toggleLayer = useMapStore((state) => state.toggleLayer)
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    // Fecha com Escape a partir de qualquer controlo do menu.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <IconButton
        label="Camadas"
        icon={<Layers className="size-4" />}
        tooltipSide="left"
        pressed={open}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <fieldset
          id={menuId}
          className="absolute top-0 right-full mr-2.5 w-56 rounded-card bg-surface-raised p-3 shadow-float ring-1 ring-border/70 motion-safe:animate-pop-in"
        >
          <legend className="float-left w-full px-1 pb-2 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
            Camadas do mapa
          </legend>
          <div className="flex flex-col gap-1">
            {LAYER_OPTIONS.map(({ layer, label }) => (
              <Toggle key={layer} label={label} checked={layers[layer]} onChange={() => toggleLayer(layer)} />
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            {SIMULATION_LAYERS.map((label) => (
              <Toggle key={label} label={label} checked={false} disabled hint="Requer o registo de cobranças" />
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
