import { createStore } from 'zustand/vanilla'
import { layoutBounds, type Bounds } from '../domain/geometry.ts'
import type { EdgeId, NetworkDataset, NodeId } from '../domain/types.ts'
import {
  clampCenter,
  easeOutCubic,
  fitBounds,
  lerpView,
  panBy,
  zoomAt,
  type ScreenPoint,
  type ViewState,
  type Viewport,
} from '../components/map/viewMath.ts'

export type Selection = { readonly kind: 'node'; readonly id: NodeId } | { readonly kind: 'edge'; readonly id: EdgeId }

export type MapLayer = 'labels' | 'tolls' | 'alternatives'
export type MapLayers = Readonly<Record<MapLayer, boolean>>

export interface MapState {
  readonly dataset: NetworkDataset
  readonly selection: Selection | null
  readonly layers: MapLayers
  readonly viewport: Viewport | null
  /** `null` até se conhecer o tamanho do viewport. */
  readonly view: ViewState | null

  select: (selection: Selection) => void
  clearSelection: () => void
  toggleLayer: (layer: MapLayer) => void
  setViewport: (viewport: Viewport) => void
  panBy: (dx: number, dy: number) => void
  zoomBy: (factor: number, anchor?: ScreenPoint) => void
  /** Volta a enquadrar a rede inteira; anima se o utilizador não preferir movimento reduzido. */
  recenter: () => void
}

/** Espaço reservado aos controlos flutuantes, para a rede enquadrada não ficar por baixo deles. */
export const FIT_PADDING = { top: 104, right: 72, bottom: 92, left: 48 }
const RECENTER_MS = 450

export interface MapStoreOptions {
  /** Permite forçar animações ligadas/desligadas (testes); por omissão segue prefers-reduced-motion. */
  readonly animate?: boolean
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function createMapStore(dataset: NetworkDataset, options: MapStoreOptions = {}) {
  const bounds: Bounds = layoutBounds(dataset)
  const nodeIds = new Set(dataset.network.nodes.map((node) => node.id))
  const edgesById = new Map(dataset.network.edges.map((edge) => [edge.id, edge]))
  let animationFrame: number | null = null

  const cancelAnimation = () => {
    if (animationFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  const isVisible = (selection: Selection, layers: MapLayers): boolean => {
    if (selection.kind === 'node') return nodeIds.has(selection.id)
    const edge = edgesById.get(selection.id)
    if (!edge) return false
    return edge.roadClass !== 'alternative' || layers.alternatives
  }

  return createStore<MapState>()((set, get) => {
    const setView = (view: ViewState) => set({ view: clampCenter(view, bounds) })
    const homeView = (viewport: Viewport) => fitBounds(bounds, viewport, FIT_PADDING)

    return {
      dataset,
      selection: null,
      layers: { labels: true, tolls: true, alternatives: true },
      viewport: null,
      view: null,

      select: (selection) => {
        // Só se seleciona o que existe e está visível; caso contrário a seleção não muda.
        if (isVisible(selection, get().layers)) set({ selection })
      },

      clearSelection: () => set({ selection: null }),

      toggleLayer: (layer) => {
        const layers = { ...get().layers, [layer]: !get().layers[layer] }
        const { selection } = get()
        set({ layers, selection: selection && isVisible(selection, layers) ? selection : null })
      },

      setViewport: (viewport) => {
        if (viewport.width <= 0 || viewport.height <= 0) return
        const { view } = get()
        set({ viewport, view: view ?? homeView(viewport) })
      },

      panBy: (dx, dy) => {
        const { view } = get()
        if (!view) return
        cancelAnimation()
        setView(panBy(view, dx, dy))
      },

      zoomBy: (factor, anchor) => {
        const { view, viewport } = get()
        if (!view || !viewport) return
        cancelAnimation()
        setView(zoomAt(view, viewport, factor, anchor))
      },

      recenter: () => {
        const { view, viewport } = get()
        if (!viewport) return
        const target = homeView(viewport)
        cancelAnimation()
        const animate = options.animate ?? !prefersReducedMotion()
        if (!view || !animate || typeof requestAnimationFrame !== 'function') {
          set({ view: target })
          return
        }
        const start = performance.now()
        const from = view
        const step = (now: number) => {
          const t = Math.min((now - start) / RECENTER_MS, 1)
          set({ view: lerpView(from, target, easeOutCubic(t)) })
          animationFrame = t < 1 ? requestAnimationFrame(step) : null
        }
        animationFrame = requestAnimationFrame(step)
      },
    }
  })
}

export type MapStore = ReturnType<typeof createMapStore>
