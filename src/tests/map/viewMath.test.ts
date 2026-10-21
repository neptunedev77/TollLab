/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  fitBounds,
  lerpView,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToWorld,
  VERTICAL_SCALE,
  worldToScreen,
  zoomAt,
} from '../../components/map/viewMath.ts'

const viewport = { width: 800, height: 600 }
const view = { centerX: 500, centerY: 400, zoom: 1.5 }

describe('projeção', () => {
  it('o centro da vista fica no centro do ecrã', () => {
    expect(worldToScreen({ x: 500, y: 400 }, view, viewport)).toEqual({ x: 400, y: 300 })
  })

  it('o eixo vertical é comprimido pela inclinação da câmara', () => {
    const screen = worldToScreen({ x: 500, y: 500 }, view, viewport)
    expect(screen.y - 300).toBeCloseTo(100 * 1.5 * VERTICAL_SCALE)
  })

  it('screenToWorld é a inversa de worldToScreen', () => {
    const point = { x: 123.4, y: 678.9 }
    const back = screenToWorld(worldToScreen(point, view, viewport), view, viewport)
    expect(back.x).toBeCloseTo(point.x)
    expect(back.y).toBeCloseTo(point.y)
  })
})

describe('pan e zoom', () => {
  it('arrastar move o conteúdo com o cursor', () => {
    const point = { x: 520, y: 410 }
    const before = worldToScreen(point, view, viewport)
    const after = worldToScreen(point, panBy(view, 40, -25), viewport)
    expect(after.x - before.x).toBeCloseTo(40)
    expect(after.y - before.y).toBeCloseTo(-25)
  })

  it('o zoom mantém fixo o ponto sob o cursor', () => {
    const cursor = { x: 610, y: 180 }
    const under = screenToWorld(cursor, view, viewport)
    const zoomed = zoomAt(view, viewport, 2, cursor)
    expect(zoomed.zoom).toBeCloseTo(3)
    const stillUnder = screenToWorld(cursor, zoomed, viewport)
    expect(stillUnder.x).toBeCloseTo(under.x)
    expect(stillUnder.y).toBeCloseTo(under.y)
  })

  it('limita o zoom e não altera a vista quando já está no limite', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    const atMax = { ...view, zoom: MAX_ZOOM }
    expect(zoomAt(atMax, viewport, 2)).toBe(atMax)
  })
})

describe('enquadramento', () => {
  const bounds = { minX: 100, minY: 50, maxX: 900, maxY: 650 }

  it('coloca todos os cantos dentro da área com margem', () => {
    const padding = { top: 70, right: 60, bottom: 90, left: 40 }
    const fitted = fitBounds(bounds, viewport, padding)
    for (const corner of [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
    ]) {
      const screen = worldToScreen(corner, fitted, viewport)
      expect(screen.x).toBeGreaterThanOrEqual(padding.left - 0.001)
      expect(screen.x).toBeLessThanOrEqual(viewport.width - padding.right + 0.001)
      expect(screen.y).toBeGreaterThanOrEqual(padding.top - 0.001)
      expect(screen.y).toBeLessThanOrEqual(viewport.height - padding.bottom + 0.001)
    }
  })

  it('interpola entre vistas e chega exatamente ao destino', () => {
    const to = { centerX: 0, centerY: 0, zoom: 3 }
    expect(lerpView(view, to, 0)).toEqual(view)
    const end = lerpView(view, to, 1)
    expect(end.centerX).toBeCloseTo(0)
    expect(end.zoom).toBeCloseTo(3)
    // O zoom interpola em escala logarítmica: a meio fica na média geométrica.
    expect(lerpView(view, to, 0.5).zoom).toBeCloseTo(Math.sqrt(1.5 * 3))
  })
})
