import type { EdgeId, NetworkDataset, SchematicPoint } from './types.ts'

/**
 * Polilinha completa de um troço no plano esquemático: posição do nó de origem, pontos intermédios
 * e posição do nó de destino. Devolve `null` se o troço ou as posições dos nós não existirem.
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
