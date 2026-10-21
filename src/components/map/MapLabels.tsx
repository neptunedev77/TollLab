import { useMapStore } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { TILT_RAD, VERTICAL_SCALE, worldToScreen } from './viewMath.ts'

/** Os nós de ligação só ganham rótulo a partir deste zoom, para não sobrecarregar o mapa. */
const INTERCHANGE_LABEL_MIN_ZOOM = 1.3
/** Altura aproximada do topo dos marcadores 3D (unidades do esquema) e raio das cidades. */
const MARKER_TOP = 3.5
const CITY_RADIUS = 9

/**
 * Rótulos das cidades em DOM (nítidos e acessíveis), posicionados com a mesma projeção da câmara.
 * São botões: selecionar uma cidade funciona também por teclado.
 */
export function MapLabels() {
  const view = useMapStore((state) => state.view)
  const viewport = useMapStore((state) => state.viewport)
  const dataset = useMapStore((state) => state.dataset)
  const visible = useMapStore((state) => state.layers.labels)
  const selection = useMapStore((state) => state.selection)
  const select = useMapStore((state) => state.select)

  if (!view || !viewport || !visible) return null

  // Distância em píxeis do centro do marcador ao seu topo, já com a inclinação da câmara.
  const lift = (CITY_RADIUS * VERTICAL_SCALE + MARKER_TOP * Math.sin(TILT_RAD)) * view.zoom + 6

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dataset.network.nodes.map((node) => {
        const position = dataset.layout.nodePositions[node.id]
        if (!position) return null
        const city = node.kind === 'city'
        if (!city && view.zoom < INTERCHANGE_LABEL_MIN_ZOOM) return null
        const screen = worldToScreen(position, view, viewport)
        if (screen.x < -80 || screen.y < -40 || screen.x > viewport.width + 80 || screen.y > viewport.height + 40) {
          return null
        }
        const selected = selection?.kind === 'node' && selection.id === node.id

        return (
          <button
            key={node.id}
            type="button"
            aria-pressed={selected}
            onClick={() => select({ kind: 'node', id: node.id })}
            style={{ left: screen.x, top: screen.y - lift }}
            className={cx(
              'pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full px-2 py-0.5 whitespace-nowrap',
              'transition-[background-color,color,transform] duration-200 ease-spring hover:scale-105',
              city ? 'text-[0.6875rem] font-extrabold shadow-soft' : 'text-[0.625rem] font-bold',
              selected
                ? 'bg-accent text-white'
                : city
                  ? 'bg-surface-raised/95 text-ink ring-1 ring-border/70'
                  : 'bg-surface-raised/80 text-muted',
            )}
          >
            {node.name}
          </button>
        )
      })}
    </div>
  )
}
