import type { EdgeId, NodeId, RoadEdge, RoadNetwork } from './types.ts'

/** Ligação de saída de um nó: o troço usado e o nó a que chega. */
export interface OutgoingLink {
  readonly edgeId: EdgeId
  readonly to: NodeId
}

/**
 * Lista de adjacência dirigida. Um troço de dois sentidos gera uma ligação em cada sentido;
 * um troço de sentido único só gera `from → to`.
 */
export function buildAdjacency(network: RoadNetwork): ReadonlyMap<NodeId, readonly OutgoingLink[]> {
  const adjacency = new Map<NodeId, OutgoingLink[]>()
  for (const node of network.nodes) adjacency.set(node.id, [])

  const push = (from: NodeId, link: OutgoingLink) => {
    const list = adjacency.get(from)
    if (list) list.push(link)
  }

  for (const edge of network.edges) {
    push(edge.from, { edgeId: edge.id, to: edge.to })
    if (!edge.oneWay) push(edge.to, { edgeId: edge.id, to: edge.from })
  }
  return adjacency
}

/** Nós alcançáveis a partir de `start`, respeitando os sentidos de circulação. */
export function reachableFrom(
  adjacency: ReadonlyMap<NodeId, readonly OutgoingLink[]>,
  start: NodeId,
): ReadonlySet<NodeId> {
  const visited = new Set<NodeId>()
  if (!adjacency.has(start)) return visited

  const stack: NodeId[] = [start]
  visited.add(start)
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    for (const link of adjacency.get(current) ?? []) {
      if (!visited.has(link.to)) {
        visited.add(link.to)
        stack.push(link.to)
      }
    }
  }
  return visited
}

/** Indica se `edge` pode ser percorrido de `from` para `to`. */
export function canTraverse(edge: RoadEdge, from: NodeId, to: NodeId): boolean {
  if (edge.from === from && edge.to === to) return true
  return !edge.oneWay && edge.from === to && edge.to === from
}
