import { createStore } from 'zustand/vanilla'
import { layoutBounds, type Bounds } from '../domain/geometry.ts'
import { formatEuros } from '../domain/money.ts'
import * as tollOps from '../domain/tolls.ts'
import type { EdgeId, NetworkDataset, NodeId, TollId, TollPoint, VehicleClass } from '../domain/types.ts'
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

export type Selection =
  | { readonly kind: 'node'; readonly id: NodeId }
  | { readonly kind: 'edge'; readonly id: EdgeId }
  | { readonly kind: 'toll'; readonly id: TollId }

export type MapLayer = 'labels' | 'tolls' | 'alternatives'
export type MapLayers = Readonly<Record<MapLayer, boolean>>

export type MapMode = { readonly kind: 'idle' } | { readonly kind: 'placing' }

export interface Notice {
  /** Muda a cada notificação, para reiniciar o temporizador mesmo com a mesma mensagem. */
  readonly id: number
  readonly message: string
  readonly tone: 'info' | 'error'
  /** Mostra a ação "Anular". */
  readonly undoable: boolean
}

interface HistoryEntry {
  readonly tolls: readonly TollPoint[]
  readonly label: string
  /** Alterações seguidas com a mesma chave juntam-se num só passo do histórico. */
  readonly key: string | undefined
  readonly at: number
}

export interface MapState {
  readonly dataset: NetworkDataset
  /** Pórticos editáveis do cenário atual (o `dataset.tolls` original nunca é alterado). */
  readonly tolls: readonly TollPoint[]
  readonly selection: Selection | null
  /** Elemento sob o cursor na cena 3D (para o cursor e o realce). */
  readonly hover: Selection | null
  readonly layers: MapLayers
  readonly mode: MapMode
  /** Pórtico a ser arrastado, com o estado de antes do arrasto (para cancelar). */
  readonly drag: { readonly tollId: TollId; readonly before: readonly TollPoint[] } | null
  readonly notice: Notice | null
  readonly past: readonly HistoryEntry[]
  readonly future: readonly HistoryEntry[]
  readonly viewport: Viewport | null
  /** `null` até se conhecer o tamanho do viewport. */
  readonly view: ViewState | null

  select: (selection: Selection) => void
  clearSelection: () => void
  setHover: (hover: Selection | null) => void
  toggleLayer: (layer: MapLayer) => void

  beginPlacement: () => void
  cancelPlacement: () => void
  /** Coloca um pórtico num troço; sem `position`, usa o maior espaço livre. Devolve se resultou. */
  addToll: (edgeId: EdgeId, position?: number) => boolean
  moveToll: (id: TollId, edgeId: EdgeId, position: number) => boolean
  beginTollDrag: (id: TollId) => void
  /** Pré-visualiza a posição durante o arrasto, sem criar passos de histórico. */
  dragTollTo: (edgeId: EdgeId, position: number) => void
  endTollDrag: (commit: boolean) => void
  setTollActive: (id: TollId, active: boolean) => void
  setTollTariff: (id: TollId, vehicleClass: VehicleClass, cents: number) => boolean
  removeToll: (id: TollId) => void
  resetTolls: () => void
  undo: () => void
  redo: () => void
  dismissNotice: () => void

  setViewport: (viewport: Viewport) => void
  panBy: (dx: number, dy: number) => void
  zoomBy: (factor: number, anchor?: ScreenPoint) => void
  /** Volta a enquadrar a rede inteira; anima se o utilizador não preferir movimento reduzido. */
  recenter: () => void
}

/** Espaço reservado aos controlos flutuantes, para a rede enquadrada não ficar por baixo deles. */
export const FIT_PADDING = { top: 104, right: 72, bottom: 92, left: 48 }
const RECENTER_MS = 450
const HISTORY_LIMIT = 100
/** Alterações com a mesma chave dentro deste intervalo (ms) contam como um só passo. */
const COALESCE_MS = 1500

export interface MapStoreOptions {
  /** Permite forçar animações ligadas/desligadas (testes); por omissão segue prefers-reduced-motion. */
  readonly animate?: boolean
  /** Relógio injetável (testes do agrupamento do histórico). */
  readonly now?: () => number
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function createMapStore(dataset: NetworkDataset, options: MapStoreOptions = {}) {
  // Enquadramento inicial: a rede. Limite do pan: o plano do mapa inteiro (todo o país).
  const networkBounds: Bounds = layoutBounds(dataset)
  const panBounds: Bounds = { minX: 0, minY: 0, maxX: dataset.layout.bounds.width, maxY: dataset.layout.bounds.height }
  const nodeIds = new Set(dataset.network.nodes.map((node) => node.id))
  const edgesById = new Map(dataset.network.edges.map((edge) => [edge.id, edge]))
  const now = options.now ?? (() => Date.now())
  let animationFrame: number | null = null
  let noticeId = 0

  const cancelAnimation = () => {
    if (animationFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  const edgeVisible = (edgeId: EdgeId, layers: MapLayers) => {
    const edge = edgesById.get(edgeId)
    return edge !== undefined && (edge.roadClass !== 'alternative' || layers.alternatives)
  }

  return createStore<MapState>()((set, get) => {
    const isVisible = (selection: Selection, state: Pick<MapState, 'layers' | 'tolls'>): boolean => {
      if (selection.kind === 'node') return nodeIds.has(selection.id)
      if (selection.kind === 'edge') return edgeVisible(selection.id, state.layers)
      const toll = state.tolls.find((candidate) => candidate.id === selection.id)
      return toll !== undefined && state.layers.tolls && edgeVisible(toll.edgeId, state.layers)
    }

    const notify = (message: string, tone: Notice['tone'] = 'info', undoable = false) =>
      set({ notice: { id: ++noticeId, message, tone, undoable } })

    /** Aplica uma alteração aos pórticos e regista o estado anterior no histórico. */
    const commit = (tolls: readonly TollPoint[], label: string, key?: string, before = get().tolls) => {
      const { past } = get()
      const last = past.at(-1)
      const at = now()
      const coalesce = key !== undefined && last?.key === key && at - last.at < COALESCE_MS
      const nextPast = coalesce
        ? [...past.slice(0, -1), { ...last, at, label }]
        : [...past, { tolls: before, label, key, at }].slice(-HISTORY_LIMIT)
      const state = { ...get(), tolls }
      const selection = state.selection && isVisible(state.selection, state) ? state.selection : null
      set({ tolls, past: nextPast, future: [], selection })
    }

    const apply = (edit: tollOps.TollEdit, label: (toll: TollPoint) => string, key?: string): boolean => {
      if (!edit.ok) {
        notify(edit.message, 'error')
        return false
      }
      commit(edit.tolls, label(edit.toll), key)
      return true
    }

    const setView = (view: ViewState) => set({ view: clampCenter(view, panBounds, 0) })
    const homeView = (viewport: Viewport) => fitBounds(networkBounds, viewport, FIT_PADDING)

    return {
      dataset,
      tolls: dataset.tolls,
      selection: null,
      hover: null,
      layers: { labels: true, tolls: true, alternatives: true },
      mode: { kind: 'idle' },
      drag: null,
      notice: null,
      past: [],
      future: [],
      viewport: null,
      view: null,

      select: (selection) => {
        // Só se seleciona o que existe e está visível; caso contrário a seleção não muda.
        if (isVisible(selection, get())) set({ selection })
      },

      clearSelection: () => set({ selection: null }),

      setHover: (hover) => {
        const current = get().hover
        if (current?.kind !== hover?.kind || current?.id !== hover?.id) set({ hover })
      },

      toggleLayer: (layer) => {
        const layers = { ...get().layers, [layer]: !get().layers[layer] }
        const { selection, tolls } = get()
        set({ layers, selection: selection && isVisible(selection, { layers, tolls }) ? selection : null })
      },

      beginPlacement: () => {
        if (!get().layers.tolls) set({ layers: { ...get().layers, tolls: true } })
        set({ mode: { kind: 'placing' }, selection: null })
      },

      cancelPlacement: () => set({ mode: { kind: 'idle' } }),

      addToll: (edgeId, position) => {
        const edit = tollOps.addToll(dataset, get().tolls, { edgeId, position })
        set({ mode: { kind: 'idle' } })
        const ok = apply(edit, (toll) => `Pórtico adicionado: ${toll.name}`)
        if (ok && edit.ok) {
          set({ selection: { kind: 'toll', id: edit.toll.id } })
          notify(`Pórtico adicionado ao troço ${edgesById.get(edgeId)?.ref ?? ''}.`, 'info', true)
        }
        return ok
      },

      moveToll: (id, edgeId, position) => {
        const ok = apply(tollOps.moveToll(dataset, get().tolls, id, edgeId, position), (toll) => `Pórtico movido: ${toll.name}`, `move:${id}`)
        return ok
      },

      beginTollDrag: (id) => {
        if (!get().tolls.some((toll) => toll.id === id)) return
        set({ drag: { tollId: id, before: get().tolls }, selection: { kind: 'toll', id } })
      },

      dragTollTo: (edgeId, position) => {
        const { drag, tolls } = get()
        if (!drag) return
        const edit = tollOps.moveToll(dataset, tolls, drag.tollId, edgeId, position)
        // Posições inválidas (ex.: em cima de outro pórtico) são ignoradas: fica a última válida.
        if (edit.ok) set({ tolls: edit.tolls })
      },

      endTollDrag: (commitDrag) => {
        const { drag, tolls } = get()
        if (!drag) return
        set({ drag: null })
        if (!commitDrag) {
          set({ tolls: drag.before })
          notify('Movimento cancelado.')
          return
        }
        const before = drag.before.find((toll) => toll.id === drag.tollId)
        const after = tolls.find((toll) => toll.id === drag.tollId)
        if (!before || !after || (before.edgeId === after.edgeId && before.position === after.position)) return
        commit(tolls, `Pórtico movido: ${after.name}`, undefined, drag.before)
        const edge = edgesById.get(after.edgeId)
        notify(`Pórtico movido${edge && edge.id !== before.edgeId ? ` para o troço ${edge.ref}` : ''}.`, 'info', true)
      },

      setTollActive: (id, active) => {
        const ok = apply(tollOps.setTollActive(dataset, get().tolls, id, active), (toll) =>
          `${active ? 'Cobrança ativada' : 'Cobrança desativada'}: ${toll.name}`,
        )
        if (ok) notify(active ? 'Cobrança ativada.' : 'Cobrança desativada.', 'info', true)
      },

      setTollTariff: (id, vehicleClass, cents) =>
        apply(
          tollOps.setTollTariff(dataset, get().tolls, id, vehicleClass, cents),
          (toll) => `Tarifa alterada para ${formatEuros(cents)}: ${toll.name}`,
          `tariff:${id}:${vehicleClass}`,
        ),

      removeToll: (id) => {
        const toll = get().tolls.find((candidate) => candidate.id === id)
        if (!toll) return
        commit(tollOps.removeToll(get().tolls, id), `Pórtico removido: ${toll.name}`)
        notify('Pórtico removido.', 'info', true)
      },

      resetTolls: () => {
        if (get().tolls === dataset.tolls) return
        commit(dataset.tolls, 'Configuração reposta')
        notify('Pórticos repostos à configuração inicial.', 'info', true)
      },

      undo: () => {
        const { past, future, tolls, drag } = get()
        const entry = past.at(-1)
        if (!entry || drag) return
        const state = { ...get(), tolls: entry.tolls }
        set({
          tolls: entry.tolls,
          past: past.slice(0, -1),
          future: [...future, { ...entry, tolls }],
          selection: state.selection && isVisible(state.selection, state) ? state.selection : null,
        })
        notify(`Anulado: ${entry.label}`)
      },

      redo: () => {
        const { past, future, tolls, drag } = get()
        const entry = future.at(-1)
        if (!entry || drag) return
        const state = { ...get(), tolls: entry.tolls }
        set({
          tolls: entry.tolls,
          future: future.slice(0, -1),
          past: [...past, { ...entry, tolls }],
          selection: state.selection && isVisible(state.selection, state) ? state.selection : null,
        })
        notify(`Refeito: ${entry.label}`)
      },

      dismissNotice: () => set({ notice: null }),

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
        const step = (time: number) => {
          const t = Math.min((time - start) / RECENTER_MS, 1)
          set({ view: lerpView(from, target, easeOutCubic(t)) })
          animationFrame = t < 1 ? requestAnimationFrame(step) : null
        }
        animationFrame = requestAnimationFrame(step)
      },
    }
  })
}

export type MapStore = ReturnType<typeof createMapStore>
