import { createStore } from 'zustand/vanilla'
import { layoutBounds, type Bounds } from '../domain/geometry.ts'
import { formatEuros } from '../domain/money.ts'
import * as tollOps from '../domain/tolls.ts'
import type { RoadColoring } from '../components/scene3d/palette.ts'
import { DEFAULT_SEED, demoDemand } from '../data/demoDemand.ts'
import type { DemandSpec, EdgeId, NetworkDataset, NodeId, TollId, TollPoint, VehicleClass } from '../domain/types.ts'
import type { PlaybackStats } from '../simulation/playback.ts'
import { browserStorage, loadScenarios, saveScenarios, type KeyValueStorage } from '../scenarios/persistence.ts'
import {
  createScenario,
  duplicateScenario as duplicateScenarioRecord,
  nextScenarioName,
  uniqueScenarioName,
  updateScenario,
  type Scenario,
} from '../scenarios/scenario.ts'
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

export type PlaybackStatus = 'idle' | 'running' | 'paused' | 'finished'
export type PlaybackSpeed = 1 | 2 | 4

export interface PlaybackState {
  readonly status: PlaybackStatus
  readonly speed: PlaybackSpeed
  /** Últimas estatísticas do motor (atualizadas algumas vezes por segundo, não a cada fotograma). */
  readonly stats: PlaybackStats | null
  /** Incrementa a cada reinício, para o controlador repor o motor. */
  readonly resetToken: number
}

export interface Notice {
  /** Muda a cada notificação, para reiniciar o temporizador mesmo com a mesma mensagem. */
  readonly id: number
  readonly message: string
  readonly tone: 'info' | 'error'
  /** Mostra a ação "Anular". */
  readonly undoable: boolean
  /** Quando presente, "Anular" repõe este cenário apagado (em vez de usar o histórico de pórticos). */
  readonly restoreScenario?: Scenario
}

export type PanelView = 'map' | 'scenarios'

/** Semente máxima aceite (inteiro de 31 bits, positivo). */
export const MAX_SEED = 2_147_483_647

interface HistoryEntry {
  readonly tolls: readonly TollPoint[]
  readonly label: string
  /** Alterações seguidas com a mesma chave juntam-se num só passo do histórico. */
  readonly key: string | undefined
  readonly at: number
}

export interface MapState {
  readonly dataset: NetworkDataset
  /** Procura usada pelo motor de percursos (pressupostos do cenário). */
  readonly demand: DemandSpec
  /** Semente das simulações: mesma semente e parâmetros → mesmos resultados. */
  readonly seed: number
  /** Pórticos editáveis do cenário atual (o `dataset.tolls` original nunca é alterado). */
  readonly tolls: readonly TollPoint[]
  readonly selection: Selection | null
  /** Elemento sob o cursor na cena 3D (para o cursor e o realce). */
  readonly hover: Selection | null
  readonly layers: MapLayers
  /** O que a cor das estradas representa: classe da via, tráfego, preço ou receita. */
  readonly coloring: RoadColoring
  readonly mode: MapMode
  /** Pórtico a ser arrastado, com o estado de antes do arrasto (para cancelar). */
  readonly drag: { readonly tollId: TollId; readonly before: readonly TollPoint[] } | null
  readonly notice: Notice | null
  readonly playback: PlaybackState
  /** Cenários guardados (cópias imutáveis e independentes). */
  readonly scenarios: readonly Scenario[]
  /** Cenário cuja configuração está carregada no editor, se algum. */
  readonly activeScenarioId: string | null
  /** Avisos do carregamento dos cenários guardados (ex.: dados corrompidos ignorados). */
  readonly scenarioWarnings: readonly string[]
  readonly panelView: PanelView
  readonly past: readonly HistoryEntry[]
  readonly future: readonly HistoryEntry[]
  readonly viewport: Viewport | null
  /** `null` até se conhecer o tamanho do viewport. */
  readonly view: ViewState | null

  select: (selection: Selection) => void
  clearSelection: () => void
  setHover: (hover: Selection | null) => void
  toggleLayer: (layer: MapLayer) => void
  setColoring: (coloring: RoadColoring) => void

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
  /** Ação "Anular" da notificação atual. */
  undoNotice: () => void
  redo: () => void
  dismissNotice: () => void

  play: () => void
  pause: () => void
  /** Volta ao início da hora simulada (os veículos regressam às origens). */
  restart: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  /** Uso interno do controlador de reprodução. */
  reportPlayback: (stats: PlaybackStats) => void

  setPanelView: (view: PanelView) => void
  /** Guarda a configuração atual como cenário novo e torna-o ativo; devolve o ID. */
  saveScenarioAs: (name?: string) => string | null
  /** Grava a configuração atual por cima do cenário ativo. */
  saveActiveScenario: () => void
  /** Carrega a configuração de um cenário no editor (pórticos e semente). */
  loadScenario: (id: string) => void
  duplicateScenario: (id: string) => void
  renameScenario: (id: string, name: string) => void
  deleteScenario: (id: string) => void
  dismissScenarioWarnings: () => void
  /** Muda a semente das simulações; devolve `false` se não for um inteiro válido. */
  setSeed: (seed: number) => boolean

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
  readonly demand?: DemandSpec
  readonly seed?: number
  /** Armazenamento dos cenários; por omissão o `localStorage` (quando disponível). `null` desliga. */
  readonly storage?: KeyValueStorage | null
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
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const defaultDemand = options.demand ?? demoDemand
  const loaded = loadScenarios(storage, { dataset, defaultDemand })
  const nowDate = () => new Date(now())

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

    const notify = (message: string, tone: Notice['tone'] = 'info', undoable = false, restoreScenario?: Scenario) =>
      set({ notice: { id: ++noticeId, message, tone, undoable, ...(restoreScenario ? { restoreScenario } : {}) } })

    /** Atualiza a lista de cenários e grava-a; avisa se a gravação falhar. */
    const setScenarios = (scenarios: readonly Scenario[], activeScenarioId = get().activeScenarioId) => {
      set({ scenarios, activeScenarioId })
      if (!loaded.canSave) {
        notify('Os cenários não podem ser guardados neste browser (os existentes foram mantidos intactos).', 'error')
        return false
      }
      const result = saveScenarios(storage, scenarios)
      if (!result.ok) notify(result.message, 'error')
      return result.ok
    }

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
      demand: defaultDemand,
      seed: options.seed ?? DEFAULT_SEED,
      tolls: dataset.tolls,
      selection: null,
      hover: null,
      layers: { labels: true, tolls: true, alternatives: true },
      coloring: 'network',
      mode: { kind: 'idle' },
      drag: null,
      notice: null,
      playback: { status: 'idle', speed: 1, stats: null, resetToken: 0 },
      scenarios: loaded.scenarios,
      activeScenarioId: null,
      scenarioWarnings: loaded.warnings,
      panelView: 'map',
      past: [],
      future: [],
      viewport: null,
      view: null,

      select: (selection) => {
        // Só se seleciona o que existe e está visível; caso contrário a seleção não muda.
        // Selecionar no mapa volta a mostrar o painel da seleção (mesmo com os cenários abertos).
        if (isVisible(selection, get())) set({ selection, panelView: 'map' })
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

      setColoring: (coloring) => set({ coloring }),

      beginPlacement: () => {
        if (!get().layers.tolls) set({ layers: { ...get().layers, tolls: true } })
        set({ mode: { kind: 'placing' }, selection: null, panelView: 'map' })
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

      undoNotice: () => {
        const { notice } = get()
        if (notice?.restoreScenario) {
          const restored = notice.restoreScenario
          if (!get().scenarios.some((scenario) => scenario.id === restored.id)) setScenarios([...get().scenarios, restored])
          notify(`Cenário "${restored.name}" reposto.`)
          return
        }
        get().undo()
      },

      play: () => {
        const { playback } = get()
        // Depois de concluída, "Iniciar" recomeça do início.
        if (playback.status === 'finished') {
          set({ playback: { ...playback, status: 'running', stats: null, resetToken: playback.resetToken + 1 } })
          return
        }
        set({ playback: { ...playback, status: 'running' } })
      },

      pause: () => {
        const { playback } = get()
        if (playback.status === 'running') set({ playback: { ...playback, status: 'paused' } })
      },

      restart: () => {
        const { playback } = get()
        set({ playback: { ...playback, status: 'idle', stats: null, resetToken: playback.resetToken + 1 } })
      },

      setSpeed: (speed) => set({ playback: { ...get().playback, speed } }),

      reportPlayback: (stats) => {
        const { playback } = get()
        set({ playback: { ...playback, stats, status: stats.finished && playback.status === 'running' ? 'finished' : playback.status } })
      },

      setPanelView: (panelView) => set({ panelView }),

      saveScenarioAs: (name) => {
        const { scenarios, tolls, demand, seed } = get()
        const finalName = uniqueScenarioName(scenarios, name?.trim() || nextScenarioName(scenarios))
        const scenario = createScenario(dataset, { name: finalName, tolls, demand, seed }, { now: nowDate })
        if (setScenarios([...scenarios, scenario], scenario.id)) notify(`Cenário "${scenario.name}" guardado.`)
        return scenario.id
      },

      saveActiveScenario: () => {
        const { scenarios, activeScenarioId, tolls, demand, seed } = get()
        const active = scenarios.find((scenario) => scenario.id === activeScenarioId)
        if (!active) return
        const updated = updateScenario(dataset, active, { tolls, demand, seed }, nowDate)
        if (setScenarios(scenarios.map((scenario) => (scenario.id === active.id ? updated : scenario)))) {
          notify(`Cenário "${updated.name}" atualizado.`)
        }
      },

      loadScenario: (id) => {
        const scenario = get().scenarios.find((candidate) => candidate.id === id)
        if (!scenario) return
        // Os pórticos do cenário são imutáveis: as edições seguintes criam listas novas e nunca o alteram.
        commit(scenario.tolls, `Cenário carregado: ${scenario.name}`)
        set({ seed: scenario.seed, activeScenarioId: scenario.id, selection: null })
        get().restart()
        notify(`Cenário "${scenario.name}" carregado.`, 'info', true)
      },

      duplicateScenario: (id) => {
        const { scenarios } = get()
        const original = scenarios.find((scenario) => scenario.id === id)
        if (!original) return
        const copy = duplicateScenarioRecord(original, uniqueScenarioName(scenarios, `${original.name} (cópia)`), { now: nowDate })
        if (setScenarios([...scenarios, copy])) notify(`Cenário duplicado como "${copy.name}".`)
      },

      renameScenario: (id, name) => {
        const { scenarios } = get()
        const scenario = scenarios.find((candidate) => candidate.id === id)
        const trimmed = name.trim()
        if (!scenario || !trimmed || trimmed === scenario.name) return
        const unique = uniqueScenarioName(scenarios.filter((candidate) => candidate.id !== id), trimmed)
        setScenarios(scenarios.map((candidate) => (candidate.id === id ? updateScenario(dataset, candidate, { name: unique }, nowDate) : candidate)))
      },

      deleteScenario: (id) => {
        const { scenarios, activeScenarioId } = get()
        const scenario = scenarios.find((candidate) => candidate.id === id)
        if (!scenario) return
        const ok = setScenarios(
          scenarios.filter((candidate) => candidate.id !== id),
          activeScenarioId === id ? null : activeScenarioId,
        )
        if (ok) notify(`Cenário "${scenario.name}" apagado.`, 'info', true, scenario)
      },

      dismissScenarioWarnings: () => set({ scenarioWarnings: [] }),

      setSeed: (seed) => {
        if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) return false
        if (seed === get().seed) return true
        set({ seed })
        get().restart()
        return true
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
