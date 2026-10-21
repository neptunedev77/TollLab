/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, worldToScreen } from '../../components/map/viewMath.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { createMapStore, FIT_PADDING } from '../../store/mapStore.ts'

const viewport = { width: 1000, height: 700 }

function readyStore() {
  const store = createMapStore(demoNetwork, { animate: false })
  store.getState().setViewport(viewport)
  return store
}

describe('mapStore: seleção', () => {
  it('seleciona nós e troços existentes; a seleção é única', () => {
    const store = readyStore()
    store.getState().select({ kind: 'node', id: 'porto' })
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'porto' })

    store.getState().select({ kind: 'edge', id: 'a3-porto-maia' })
    expect(store.getState().selection).toEqual({ kind: 'edge', id: 'a3-porto-maia' })

    store.getState().clearSelection()
    expect(store.getState().selection).toBeNull()
  })

  it('ignora seleções de elementos inexistentes', () => {
    const store = readyStore()
    store.getState().select({ kind: 'node', id: 'porto' })
    store.getState().select({ kind: 'edge', id: 'nao-existe' })
    store.getState().select({ kind: 'node', id: 'lisboa' })
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'porto' })
  })

  it('não seleciona vias alternativas escondidas', () => {
    const store = readyStore()
    store.getState().toggleLayer('alternatives')
    store.getState().select({ kind: 'edge', id: 'n14-porto-famalicao' })
    expect(store.getState().selection).toBeNull()
  })

  it('esconder as alternativas limpa só uma seleção que deixa de estar visível', () => {
    const store = readyStore()
    store.getState().select({ kind: 'edge', id: 'n14-porto-famalicao' })
    store.getState().toggleLayer('alternatives')
    expect(store.getState().selection).toBeNull()

    store.getState().toggleLayer('alternatives')
    store.getState().select({ kind: 'edge', id: 'a3-porto-maia' })
    store.getState().toggleLayer('alternatives')
    expect(store.getState().selection).toEqual({ kind: 'edge', id: 'a3-porto-maia' })
  })

  it('a seleção mantém-se ao navegar no mapa', () => {
    const store = readyStore()
    store.getState().select({ kind: 'node', id: 'braga' })
    store.getState().panBy(120, 40)
    store.getState().zoomBy(2)
    store.getState().recenter()
    store.getState().toggleLayer('labels')
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'braga' })
  })
})

describe('mapStore: vista', () => {
  it('não tem vista até conhecer um viewport válido', () => {
    const store = createMapStore(demoNetwork, { animate: false })
    store.getState().setViewport({ width: 0, height: 600 })
    expect(store.getState().view).toBeNull()
    store.getState().panBy(10, 10)
    expect(store.getState().view).toBeNull()
  })

  it('enquadra toda a rede dentro da área livre dos controlos', () => {
    const { view } = readyStore().getState()
    if (!view) throw new Error('sem vista')
    for (const point of Object.values(demoNetwork.layout.nodePositions)) {
      const screen = worldToScreen(point, view, viewport)
      expect(screen.x).toBeGreaterThanOrEqual(FIT_PADDING.left - 1)
      expect(screen.x).toBeLessThanOrEqual(viewport.width - FIT_PADDING.right + 1)
      expect(screen.y).toBeGreaterThanOrEqual(FIT_PADDING.top - 1)
      expect(screen.y).toBeLessThanOrEqual(viewport.height - FIT_PADDING.bottom + 1)
    }
  })

  it('redimensionar mantém a vista atual', () => {
    const store = readyStore()
    store.getState().panBy(50, 0)
    const before = store.getState().view
    store.getState().setViewport({ width: 1200, height: 800 })
    expect(store.getState().view).toEqual(before)
  })

  it('limita o zoom e o afastamento do centro', () => {
    const store = readyStore()
    store.getState().zoomBy(1000)
    expect(store.getState().view?.zoom).toBe(MAX_ZOOM)
    store.getState().zoomBy(0.00001)
    expect(store.getState().view?.zoom).toBe(MIN_ZOOM)

    store.getState().panBy(1_000_000, 1_000_000)
    const view = store.getState().view
    expect(view?.centerX).toBeGreaterThan(-1000)
    expect(view?.centerY).toBeGreaterThan(-1000)
  })

  it('recentrar devolve exatamente a vista inicial', () => {
    const store = readyStore()
    const home = store.getState().view
    store.getState().panBy(-300, 220)
    store.getState().zoomBy(2.5)
    store.getState().recenter()
    expect(store.getState().view).toEqual(home)
  })
})
