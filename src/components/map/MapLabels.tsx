import type { NetworkDataset, NodeId } from '../../domain/types.ts'
import { project } from '../../data/geo/projection.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { NODE_RADIUS } from '../scene3d/palette.ts'
import { TILT_RAD, VERTICAL_SCALE, worldToScreen, type ScreenPoint } from './viewMath.ts'

/** Os nós de ligação só ganham rótulo a partir deste zoom, para não sobrecarregar o mapa. */
const INTERCHANGE_LABEL_MIN_ZOOM = 2
/** Altura aproximada do topo dos marcadores 3D (unidades do mapa). */
const MARKER_TOP = 2.8
const LABEL_HEIGHT = 20
const LABEL_GAP = 4

/** Rótulos de regiões do mapa base (posições só para legibilidade; não são dados). */
const REGION_LABELS = [
  { text: 'Oceano Atlântico', at: project([-9.75, 40.6]) },
  { text: 'Espanha', at: project([-6.4, 42.55]) },
  { text: 'Portugal', at: project([-7.95, 39.6]) },
]

/** Cidades com mais ligações primeiro: ficam com o rótulo quando não há espaço para todos. */
function labelPriority(dataset: NetworkDataset): NodeId[] {
  const degree = new Map<NodeId, number>()
  for (const edge of dataset.network.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1)
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1)
  }
  return [...dataset.network.nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .map((node) => node.id)
}

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + LABEL_GAP && b.left < a.right + LABEL_GAP && a.top < b.bottom + LABEL_GAP && b.top < a.bottom + LABEL_GAP

/** Largura estimada de um rótulo (evita medir o DOM a cada frame de pan). */
const estimateWidth = (text: string, small: boolean) => text.length * (small ? 5.6 : 6.3) + 18

/**
 * Rótulos das cidades em DOM (nítidos e acessíveis), posicionados com a mesma projeção da câmara.
 * São botões: selecionar uma cidade funciona também por teclado. Quando se sobrepõem, ficam os de
 * maior prioridade (e sempre o da cidade selecionada).
 */
export function MapLabels() {
  const view = useMapStore((state) => state.view)
  const viewport = useMapStore((state) => state.viewport)
  const dataset = useMapStore((state) => state.dataset)
  const visible = useMapStore((state) => state.layers.labels)
  const selection = useMapStore((state) => state.selection)
  const select = useMapStore((state) => state.select)

  if (!view || !viewport) return null

  const nodesById = new Map(dataset.network.nodes.map((node) => [node.id, node]))
  const selectedId = selection?.kind === 'node' ? selection.id : null
  const order = labelPriority(dataset)
  if (selectedId) order.unshift(selectedId)

  const placed: Rect[] = []
  const labels: Array<{ id: NodeId; screen: ScreenPoint; lift: number; below: boolean }> = []
  for (const id of new Set(order)) {
    const node = nodesById.get(id)
    const position = dataset.layout.nodePositions[id]
    if (!node || !position) continue
    const city = node.kind === 'city'
    if (!city && view.zoom < INTERCHANGE_LABEL_MIN_ZOOM && id !== selectedId) continue
    const screen = worldToScreen(position, view, viewport)
    if (screen.x < -80 || screen.y < -40 || screen.x > viewport.width + 80 || screen.y > viewport.height + 40) continue

    const radius = city ? NODE_RADIUS.city : NODE_RADIUS.interchange
    // Distância do centro do marcador ao seu topo no ecrã, já com a inclinação da câmara.
    const lift = (radius * VERTICAL_SCALE + MARKER_TOP * Math.sin(TILT_RAD)) * view.zoom + 5
    const width = estimateWidth(node.shortName ?? node.name, !city)
    const horizontal = { left: screen.x - width / 2, right: screen.x + width / 2 }
    // Primeiro por cima do marcador; se colidir, por baixo; se ainda colidir, fica sem rótulo.
    const above = { ...horizontal, top: screen.y - lift - LABEL_HEIGHT, bottom: screen.y - lift }
    const under = { ...horizontal, top: screen.y + lift, bottom: screen.y + lift + LABEL_HEIGHT }
    const free = (rect: Rect) => id === selectedId || !placed.some((other) => overlaps(rect, other))
    const below = !free(above) && free(under)
    if (!free(above) && !below) continue
    placed.push(below ? under : above)
    labels.push({ id, screen, lift, below })
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {REGION_LABELS.map((region) => {
        const screen = worldToScreen(region.at, view, viewport)
        return (
          <span
            key={region.text}
            style={{ left: screen.x, top: screen.y }}
            className={cx(
              'absolute -translate-x-1/2 -translate-y-1/2 text-[0.6875rem] font-extrabold tracking-[0.3em] whitespace-nowrap uppercase select-none',
              region.text === 'Oceano Atlântico' ? 'text-[#8fb0bf]' : 'text-[#c5b8a4]',
            )}
          >
            {region.text}
          </span>
        )
      })}
      {visible &&
        labels.map(({ id, screen, lift, below }) => {
          const node = nodesById.get(id)
          if (!node) return null
          const city = node.kind === 'city'
          const selected = id === selectedId
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              // O nome acessível é sempre o nome completo, mesmo quando o rótulo é curto.
              aria-label={node.shortName ? node.name : undefined}
              onClick={() => select({ kind: 'node', id })}
              style={{ left: screen.x, top: below ? screen.y + lift : screen.y - lift }}
              className={cx(
                'pointer-events-auto absolute -translate-x-1/2 rounded-full px-2 py-0.5 whitespace-nowrap',
                !below && '-translate-y-full',
                'transition-[background-color,color,transform] duration-200 ease-spring hover:scale-105',
                city ? 'text-[0.6875rem] font-extrabold shadow-soft' : 'text-[0.625rem] font-bold',
                selected
                  ? 'bg-accent text-white'
                  : city
                    ? 'bg-surface-raised/95 text-ink ring-1 ring-border/70'
                    : 'bg-surface-raised/80 text-muted',
              )}
            >
              {node.shortName ?? node.name}
            </button>
          )
        })}
    </div>
  )
}
