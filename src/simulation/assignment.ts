import type { DemandSpec, EdgeId, NetworkDataset, NodeId, RoadEdge, RouteStep, TollId, TollPoint, Vehicle, VehicleId } from '../domain/types.ts'
import { centsPerMinute, directedKey, edgeTime, generalizedCost, tollTableByEdge } from './costs.ts'
import { generateVehicles, type VehicleRequest } from './demand.ts'
import { createRandom } from './random.ts'
import { createRouter, type PathResult } from './routing.ts'

/*
 * Afetação de tráfego (escolha de percurso com congestionamento simplificado).
 *
 * 1. Gera os veículos de uma hora de procura (semente) e baralha a ordem (mesma semente).
 * 2. Afetação incremental em `increments` lotes: antes de cada lote, recalcula o tempo de cada troço
 *    por sentido (BPR) com o volume já carregado; cada veículo escolhe o percurso de menor custo
 *    generalizado para a sua classe e valor do tempo. Assim o congestionamento desvia parte do
 *    tráfego, sem oscilações (cada veículo decide uma vez).
 * 3. No fim, mede cada viagem com os tempos finais e compara-a com o percurso mais rápido (só tempo),
 *    para saber quem evitou portagens.
 *
 * Nada aqui está pré-determinado: se a tarifa sobe, os veículos cujo custo generalizado passa a ser
 * menor por uma alternativa mudam de percurso — mais ninguém.
 */

export const DEFAULT_INCREMENTS = 5

export interface AssignmentOptions {
  readonly seed: number
  readonly increments?: number
}

export interface TripOutcome {
  readonly vehicleId: VehicleId
  /** Tempo do percurso escolhido com os tempos finais (min). */
  readonly timeMin: number
  /** Portagens que o percurso escolhido atravessa (cêntimos, classe do veículo). */
  readonly tollCents: number
  readonly costMin: number
  /** Portagens do percurso mais rápido entre a mesma origem e destino (cêntimos). */
  readonly fastestTollCents: number
  /** O condutor paga menos do que pagaria no percurso mais rápido. */
  readonly avoidedTolls: boolean
}

export interface DirectedFlow {
  readonly edgeId: EdgeId
  readonly from: NodeId
  readonly to: NodeId
  readonly volume: number
  readonly capacity: number
  readonly timeMin: number
}

export interface AssignmentSummary {
  readonly vehicles: number
  readonly routed: number
  /** Veículos sem percurso válido: ficam na origem, contados à parte. */
  readonly noRoute: number
  readonly averageTimeMin: number | null
  /** Veículos cujo percurso atravessa pelo menos um pórtico ativo. */
  readonly payingVehicles: number
  readonly avoidingTolls: number
}

export interface AssignmentResult {
  readonly seed: number
  readonly vehicles: readonly Vehicle[]
  readonly trips: ReadonlyMap<VehicleId, TripOutcome>
  readonly flows: ReadonlyMap<string, DirectedFlow>
  /** Volume total por troço (soma dos dois sentidos), veículos por hora. */
  readonly edgeVolumes: ReadonlyMap<EdgeId, number>
  /** Por pórtico: veículos cujo percurso mais rápido passa nele, mas que escolheram outro caminho. */
  readonly tollAvoiders: ReadonlyMap<TollId, number>
  readonly summary: AssignmentSummary
}

export function assignTraffic(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  demand: DemandSpec,
  options: AssignmentOptions,
): AssignmentResult {
  const { network } = dataset
  const increments = Math.max(1, Math.floor(options.increments ?? DEFAULT_INCREMENTS))
  const edges = new Map<EdgeId, RoadEdge>(network.edges.map((edge) => [edge.id, edge]))
  const tollTable = tollTableByEdge(tolls)
  const router = createRouter(network)

  const requests = generateVehicles(demand, options.seed)
  const order = createRandom(options.seed ^ 0x9e3779b9).shuffle(requests)
  const volumes = new Map<string, number>()
  const routes = new Map<VehicleId, readonly RouteStep[] | null>()

  const timeOf = (step: RouteStep, snapshot: ReadonlyMap<string, number>) => {
    const edge = edges.get(step.edgeId)
    if (!edge) return Number.POSITIVE_INFINITY
    return edgeTime(edge, snapshot.get(directedKey(step.edgeId, step.from)) ?? 0)
  }
  const tollOf = (step: RouteStep, vehicle: VehicleRequest) => tollTable.get(step.edgeId)?.[vehicle.vehicleClass] ?? 0

  const batchSize = Math.ceil(order.length / increments) || 1
  for (let start = 0; start < order.length; start += batchSize) {
    const snapshot = new Map(volumes)
    const cache = new Map<string, PathResult | null>()
    for (const vehicle of order.slice(start, start + batchSize)) {
      const key = `${vehicle.originId}|${vehicle.destinationId}|${vehicle.vehicleClass}|${vehicle.valueOfTimeEurPerHour}`
      let path = cache.get(key)
      if (path === undefined) {
        const rate = centsPerMinute(vehicle.valueOfTimeEurPerHour)
        path = router.shortestPath(vehicle.originId, vehicle.destinationId, (step) => {
          const toll = tollOf(step, vehicle)
          return timeOf(step, snapshot) + (toll > 0 ? (rate > 0 ? toll / rate : Number.POSITIVE_INFINITY) : 0)
        })
        cache.set(key, path)
      }
      routes.set(vehicle.id, path ? path.steps : null)
      for (const step of path?.steps ?? []) {
        const directed = directedKey(step.edgeId, step.from)
        volumes.set(directed, (volumes.get(directed) ?? 0) + 1)
      }
    }
  }

  // Medição final com os tempos resultantes de toda a procura.
  const fastestCache = new Map<string, PathResult | null>()
  const fastest = (origin: NodeId, destination: NodeId) => {
    const key = `${origin}|${destination}`
    if (!fastestCache.has(key)) fastestCache.set(key, router.shortestPath(origin, destination, (step) => timeOf(step, volumes)))
    return fastestCache.get(key) ?? null
  }

  const tollIdsByEdge = new Map<EdgeId, TollId[]>()
  for (const toll of tolls) if (toll.active) tollIdsByEdge.set(toll.edgeId, [...(tollIdsByEdge.get(toll.edgeId) ?? []), toll.id])

  const vehicles: Vehicle[] = []
  const trips = new Map<VehicleId, TripOutcome>()
  const tollAvoiders = new Map<TollId, number>()
  let timeSum = 0
  let paying = 0
  let avoiding = 0

  for (const request of requests) {
    const route = routes.get(request.id) ?? null
    vehicles.push({ ...request, route, status: route ? 'pending' : 'no-route' })
    if (!route) continue

    const timeMin = route.reduce((sum, step) => sum + timeOf(step, volumes), 0)
    const tollCents = route.reduce((sum, step) => sum + tollOf(step, request), 0)
    const quickest = fastest(request.originId, request.destinationId)
    const fastestTollCents = quickest ? quickest.steps.reduce((sum, step) => sum + tollOf(step, request), 0) : 0
    const avoidedTolls = fastestTollCents > tollCents
    trips.set(request.id, {
      vehicleId: request.id,
      timeMin,
      tollCents,
      costMin: generalizedCost(timeMin, tollCents, request.valueOfTimeEurPerHour),
      fastestTollCents,
      avoidedTolls,
    })
    timeSum += timeMin
    if (tollCents > 0) paying++
    if (avoidedTolls) avoiding++

    if (quickest) {
      const chosenEdges = new Set(route.map((step) => step.edgeId))
      for (const step of quickest.steps) {
        if (chosenEdges.has(step.edgeId)) continue
        for (const tollId of tollIdsByEdge.get(step.edgeId) ?? []) tollAvoiders.set(tollId, (tollAvoiders.get(tollId) ?? 0) + 1)
      }
    }
  }

  const flows = new Map<string, DirectedFlow>()
  const edgeVolumes = new Map<EdgeId, number>()
  for (const edge of network.edges) {
    const directions: Array<[NodeId, NodeId]> = edge.oneWay ? [[edge.from, edge.to]] : [[edge.from, edge.to], [edge.to, edge.from]]
    let total = 0
    for (const [from, to] of directions) {
      const volume = volumes.get(directedKey(edge.id, from)) ?? 0
      total += volume
      flows.set(directedKey(edge.id, from), {
        edgeId: edge.id,
        from,
        to,
        volume,
        capacity: edge.capacityVehPerHour,
        timeMin: edgeTime(edge, volume),
      })
    }
    edgeVolumes.set(edge.id, total)
  }

  const routed = trips.size
  return {
    seed: options.seed,
    vehicles,
    trips,
    flows,
    edgeVolumes,
    tollAvoiders,
    summary: {
      vehicles: vehicles.length,
      routed,
      noRoute: vehicles.length - routed,
      averageTimeMin: routed > 0 ? timeSum / routed : null,
      payingVehicles: paying,
      avoidingTolls: avoiding,
    },
  }
}

/** Relação volume/capacidade máxima de um troço (no sentido mais carregado). */
export function edgeLoad(result: AssignmentResult, edgeId: EdgeId): number {
  let worst = 0
  for (const flow of result.flows.values()) {
    if (flow.edgeId === edgeId && flow.capacity > 0) worst = Math.max(worst, flow.volume / flow.capacity)
  }
  return worst
}
