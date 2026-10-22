import { buildAdjacency } from '../domain/graph.ts'
import type { EdgeId, NodeId, RoadNetwork, RouteStep } from '../domain/types.ts'

export interface PathResult {
  readonly steps: readonly RouteStep[]
  readonly cost: number
}

/** Custo de dar um passo; `Infinity` torna o passo impossível. */
export type StepCost = (step: RouteStep) => number

export interface Router {
  shortestPath(origin: NodeId, destination: NodeId, cost: StepCost): PathResult | null
}

interface IndexedLink {
  readonly step: RouteStep
  readonly to: number
}

/**
 * Caminho de menor custo (Dijkstra) sobre a lista de adjacência dirigida: só segue ligações que
 * existem e respeita os sentidos únicos. Em empate, escolhe de forma determinística (ligações
 * ordenadas por ID do troço), para resultados reprodutíveis. Devolve `null` se o destino não for
 * alcançável. A adjacência é indexada e ordenada uma única vez, na criação do router.
 */
export function createRouter(network: RoadNetwork): Router {
  const adjacency = buildAdjacency(network)
  const ids = network.nodes.map((node) => node.id)
  const indexOf = new Map(ids.map((id, index) => [id, index]))
  const links: IndexedLink[][] = ids.map((id) =>
    [...(adjacency.get(id) ?? [])]
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
      .map((link) => ({ step: { edgeId: link.edgeId, from: id, to: link.to }, to: indexOf.get(link.to) ?? -1 }))
      .filter((link) => link.to >= 0),
  )
  const count = ids.length

  return {
    shortestPath(origin, destination, cost) {
      const start = indexOf.get(origin)
      const goal = indexOf.get(destination)
      if (start === undefined || goal === undefined) return null
      if (start === goal) return { steps: [], cost: 0 }

      // A rede é pequena: uma pesquisa linear pelo mínimo é simples e rápida.
      const distance = new Float64Array(count).fill(Number.POSITIVE_INFINITY)
      const done = new Uint8Array(count)
      const via: Array<IndexedLink | undefined> = new Array(count)
      distance[start] = 0

      for (;;) {
        let current = -1
        let best = Number.POSITIVE_INFINITY
        for (let index = 0; index < count; index++) {
          const d = distance[index] as number
          if (done[index] === 0 && d < best) {
            best = d
            current = index
          }
        }
        if (current < 0 || current === goal) break
        done[current] = 1

        for (const link of links[current] ?? []) {
          if (done[link.to] === 1) continue
          const stepCost = cost(link.step)
          if (!Number.isFinite(stepCost) || stepCost < 0) continue
          const candidate = best + stepCost
          if (candidate < (distance[link.to] as number)) {
            distance[link.to] = candidate
            via[link.to] = link
          }
        }
      }

      const total = distance[goal] as number
      if (!Number.isFinite(total)) return null

      const steps: RouteStep[] = []
      for (let node = goal; node !== start; ) {
        const link = via[node]
        if (!link) return null
        steps.push(link.step)
        node = indexOf.get(link.step.from) ?? start
      }
      return { steps: steps.reverse(), cost: total }
    },
  }
}

/** Verifica que os passos formam uma cadeia contínua de `origin` a `destination` (sem saltos). */
export function isConnectedRoute(
  network: RoadNetwork,
  steps: readonly RouteStep[],
  origin: NodeId,
  destination: NodeId,
): boolean {
  const edges = new Map<EdgeId, RoadNetwork['edges'][number]>(network.edges.map((edge) => [edge.id, edge]))
  let at = origin
  for (const step of steps) {
    const edge = edges.get(step.edgeId)
    if (!edge || step.from !== at) return false
    const forward = edge.from === step.from && edge.to === step.to
    const backward = !edge.oneWay && edge.to === step.from && edge.from === step.to
    if (!forward && !backward) return false
    at = step.to
  }
  return at === destination
}
