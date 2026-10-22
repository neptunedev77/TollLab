import { Crosshair, Layers, Minus, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { MapLayer } from '../../store/mapStore.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { IconButton } from '../ui/IconButton.tsx'
import type { RoadColoring } from '../scene3d/palette.ts'
import { Toggle } from '../ui/Toggle.tsx'
import { cx } from '../../utils/cx.ts'
import { ZOOM_STEP } from './MapViewport.tsx'

const LAYER_OPTIONS: ReadonlyArray<{ layer: MapLayer; label: string }> = [
  { layer: 'labels', label: 'Nomes das cidades' },
  { layer: 'tolls', label: 'Pórticos' },
  { layer: 'alternatives', label: 'Vias alternativas' },
]

const COLORING_OPTIONS: ReadonlyArray<{ value: RoadColoring; label: string; hint: string }> = [
  { value: 'network', label: 'Classe da via', hint: 'Autoestradas e vias alternativas' },
  { value: 'traffic', label: 'Tráfego', hint: 'Volume face à capacidade' },
  { value: 'price', label: 'Preço', hint: 'Tarifa da classe 1 no troço' },
  { value: 'revenue', label: 'Receita', hint: 'Receita bruta do troço' },
]

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
  const coloring = useMapStore((state) => state.coloring)
  const setColoring = useMapStore((state) => state.setColoring)
  const coloringName = useId()
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
          <fieldset className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2">
            <legend className="float-left w-full px-1 pb-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase">
              Cor das estradas
            </legend>
            {COLORING_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cx(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors duration-150 hover:bg-surface-muted',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus',
                )}
              >
                <input
                  type="radio"
                  name={coloringName}
                  value={option.value}
                  checked={coloring === option.value}
                  onChange={() => setColoring(option.value)}
                  aria-label={option.label}
                  aria-describedby={`${coloringName}-${option.value}`}
                  className="size-3.5 accent-[var(--color-accent)]"
                />
                <span aria-hidden="true" className="flex flex-col">
                  <span className="text-xs font-bold text-ink">{option.label}</span>
                  <span className="text-[0.625rem] text-subtle">{option.hint}</span>
                </span>
                <span id={`${coloringName}-${option.value}`} className="sr-only">
                  {option.hint}
                </span>
              </label>
            ))}
          </fieldset>
        </fieldset>
      )}
    </div>
  )
}
