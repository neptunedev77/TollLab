import type { Bounds } from '../../domain/geometry.ts'
import type { SchematicPoint } from '../../domain/types.ts'

/*
 * Matemática da vista do mapa: funções puras, partilhadas pela câmara 3D e pelos rótulos DOM.
 *
 * A câmara é ortográfica e inclinada TILT_RAD em relação à vertical. Numa projeção ortográfica,
 * o plano do chão projeta-se de forma afim: o eixo x do esquema mantém a escala `zoom` e o eixo y
 * do esquema é comprimido por cos(TILT). Por isso pan, zoom e projeção ficam lineares e testáveis.
 */

export const TILT_RAD = (28 * Math.PI) / 180
export const VERTICAL_SCALE = Math.cos(TILT_RAD)

/** Píxeis de ecrã por unidade do esquema. */
/** O mínimo permite ver Portugal continental inteiro; o máximo, detalhe de um nó. */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 6

export interface ViewState {
  /** Centro da vista, em coordenadas do esquema. */
  readonly centerX: number
  readonly centerY: number
  readonly zoom: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM)
}

export function worldToScreen(point: SchematicPoint, view: ViewState, viewport: Viewport): ScreenPoint {
  return {
    x: viewport.width / 2 + (point.x - view.centerX) * view.zoom,
    y: viewport.height / 2 + (point.y - view.centerY) * view.zoom * VERTICAL_SCALE,
  }
}

export function screenToWorld(point: ScreenPoint, view: ViewState, viewport: Viewport): SchematicPoint {
  return {
    x: view.centerX + (point.x - viewport.width / 2) / view.zoom,
    y: view.centerY + (point.y - viewport.height / 2) / (view.zoom * VERTICAL_SCALE),
  }
}

/** Mantém o centro dentro da rede (com margem), para o utilizador nunca "perder" o mapa. */
export function clampCenter(view: ViewState, bounds: Bounds, margin = 120): ViewState {
  return {
    ...view,
    centerX: Math.min(Math.max(view.centerX, bounds.minX - margin), bounds.maxX + margin),
    centerY: Math.min(Math.max(view.centerY, bounds.minY - margin), bounds.maxY + margin),
  }
}

/** Desloca a vista: arrastar o mapa `dx`,`dy` píxeis move o conteúdo com o cursor. */
export function panBy(view: ViewState, dx: number, dy: number): ViewState {
  return {
    ...view,
    centerX: view.centerX - dx / view.zoom,
    centerY: view.centerY - dy / (view.zoom * VERTICAL_SCALE),
  }
}

/** Zoom multiplicativo que mantém fixo o ponto do mapa sob `anchor` (por omissão, o centro). */
export function zoomAt(view: ViewState, viewport: Viewport, factor: number, anchor?: ScreenPoint): ViewState {
  const zoom = clampZoom(view.zoom * factor)
  if (zoom === view.zoom) return view
  const screen = anchor ?? { x: viewport.width / 2, y: viewport.height / 2 }
  const before = screenToWorld(screen, view, viewport)
  const scaled = { ...view, zoom }
  const after = screenToWorld(screen, scaled, viewport)
  return { ...scaled, centerX: view.centerX + before.x - after.x, centerY: view.centerY + before.y - after.y }
}

/** Vista que enquadra `bounds` no viewport, com `padding` píxeis livres em cada lado. */
export function fitBounds(bounds: Bounds, viewport: Viewport, padding: Padding = 48): ViewState {
  const pad = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding
  const usableWidth = Math.max(viewport.width - pad.left - pad.right, 1)
  const usableHeight = Math.max(viewport.height - pad.top - pad.bottom, 1)
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const zoom = clampZoom(Math.min(usableWidth / worldWidth, usableHeight / (worldHeight * VERTICAL_SCALE)))
  // O centro do mundo fica no centro da área útil (que pode não coincidir com o centro do ecrã).
  const offsetX = (pad.left - pad.right) / 2
  const offsetY = (pad.top - pad.bottom) / 2
  return {
    zoom,
    centerX: (bounds.minX + bounds.maxX) / 2 - offsetX / zoom,
    centerY: (bounds.minY + bounds.maxY) / 2 - offsetY / (zoom * VERTICAL_SCALE),
  }
}

export type Padding = number | { top: number; right: number; bottom: number; left: number }

/** Interpolação entre duas vistas (para recentrar suavemente). O zoom interpola em escala log. */
export function lerpView(from: ViewState, to: ViewState, t: number): ViewState {
  const k = Math.min(Math.max(t, 0), 1)
  return {
    centerX: from.centerX + (to.centerX - from.centerX) * k,
    centerY: from.centerY + (to.centerY - from.centerY) * k,
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k),
  }
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}
