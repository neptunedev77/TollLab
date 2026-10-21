import type { EdgeId, NetworkDataset, SchematicPoint } from './types.ts'

/**
 * Polilinha de controlo de um troço no plano esquemático: posição do nó de origem, pontos
 * intermédios e posição do nó de destino. Devolve `null` se o troço ou as posições não existirem.
 */
export function edgePolyline(dataset: NetworkDataset, edgeId: EdgeId): readonly SchematicPoint[] | null {
  const edge = dataset.network.edges.find((candidate) => candidate.id === edgeId)
  if (!edge) return null
  const start = dataset.layout.nodePositions[edge.from]
  const end = dataset.layout.nodePositions[edge.to]
  if (!start || !end) return null
  return [start, ...(dataset.layout.edgeBends[edgeId] ?? []), end]
}

export function polylineLength(points: readonly SchematicPoint[]): number {
  let total = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]
    const b = points[index]
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

export function isFinitePoint(point: SchematicPoint | undefined): point is SchematicPoint {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y)
}

/** Amostras por segmento de controlo na curva suavizada. */
export const CURVE_SAMPLES_PER_SEGMENT = 12

function catmullRom(p0: SchematicPoint, p1: SchematicPoint, p2: SchematicPoint, p3: SchematicPoint, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  const axis = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) }
}

/**
 * Curva suavizada (Catmull-Rom) que passa por todos os pontos de controlo, amostrada como
 * polilinha densa. É a geometria canónica do troço: o mapa desenha-a e os pórticos e veículos
 * posicionam-se sobre ela, por isso o que se vê coincide sempre com o modelo.
 */
export function smoothPolyline(
  control: readonly SchematicPoint[],
  samplesPerSegment = CURVE_SAMPLES_PER_SEGMENT,
): SchematicPoint[] {
  if (control.length < 3) return [...control]
  const at = (index: number): SchematicPoint => {
    const clamped = Math.min(Math.max(index, 0), control.length - 1)
    // Os pontos fora dos extremos são refletidos, para a curva sair dos nós sem "bico".
    const point = control[clamped] as SchematicPoint
    if (index === clamped) return point
    const neighbour = control[index < 0 ? 1 : control.length - 2] as SchematicPoint
    return { x: 2 * point.x - neighbour.x, y: 2 * point.y - neighbour.y }
  }

  const result: SchematicPoint[] = [control[0] as SchematicPoint]
  for (let segment = 0; segment < control.length - 1; segment++) {
    for (let step = 1; step <= samplesPerSegment; step++) {
      result.push(catmullRom(at(segment - 1), at(segment), at(segment + 1), at(segment + 2), step / samplesPerSegment))
    }
  }
  return result
}

/** Geometria canónica (curva amostrada) de um troço, ou `null` se não existir. */
export function edgeCurve(dataset: NetworkDataset, edgeId: EdgeId): readonly SchematicPoint[] | null {
  const control = edgePolyline(dataset, edgeId)
  return control ? smoothPolyline(control) : null
}

export interface PointOnLine {
  readonly point: SchematicPoint
  /** Direção unitária da linha nesse ponto. */
  readonly tangent: SchematicPoint
}

/** Ponto a uma fração `t` ∈ [0, 1] do comprimento de uma polilinha, com a respetiva direção. */
export function pointAlong(points: readonly SchematicPoint[], t: number): PointOnLine | null {
  if (points.length < 2) return null
  const total = polylineLength(points)
  if (total <= 0) return null
  const target = Math.min(Math.max(t, 0), 1) * total

  let travelled = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1] as SchematicPoint
    const b = points[index] as SchematicPoint
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length === 0) continue
    if (travelled + length >= target || index === points.length - 1) {
      const local = Math.min((target - travelled) / length, 1)
      return {
        point: { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local },
        tangent: { x: (b.x - a.x) / length, y: (b.y - a.y) / length },
      }
    }
    travelled += length
  }
  return null
}

export interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

/** Retângulo que envolve todas as posições de nós e pontos intermédios do esquema. */
export function layoutBounds(dataset: NetworkDataset): Bounds {
  const points = [...Object.values(dataset.layout.nodePositions), ...Object.values(dataset.layout.edgeBends).flat()]
  if (points.length === 0) return { minX: 0, minY: 0, maxX: dataset.layout.bounds.width, maxY: dataset.layout.bounds.height }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

export interface ProjectionOnLine {
  /** Fração do comprimento da linha, em [0, 1]. */
  readonly t: number
  readonly point: SchematicPoint
  readonly distance: number
}

/** Ponto da polilinha mais próximo de `target`, com a sua fração do comprimento. */
export function projectOntoPolyline(points: readonly SchematicPoint[], target: SchematicPoint): ProjectionOnLine | null {
  const total = polylineLength(points)
  if (points.length < 2 || total <= 0) return null
  let best: ProjectionOnLine | null = null
  let travelled = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1] as SchematicPoint
    const b = points[index] as SchematicPoint
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    const length = Math.sqrt(lengthSquared)
    if (length === 0) continue
    const local = Math.min(Math.max(((target.x - a.x) * dx + (target.y - a.y) * dy) / lengthSquared, 0), 1)
    const point = { x: a.x + dx * local, y: a.y + dy * local }
    const distance = Math.hypot(target.x - point.x, target.y - point.y)
    if (!best || distance < best.distance) best = { t: (travelled + local * length) / total, point, distance }
    travelled += length
  }
  return best
}
