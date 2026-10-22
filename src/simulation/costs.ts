import type { EdgeId, NodeId, RoadEdge, TollPoint, VehicleClass } from '../domain/types.ts'

/*
 * Custos de percorrer um troço.
 *
 * Tempo com congestionamento: função BPR (Bureau of Public Roads), por sentido,
 *   t = t0 · (1 + α · (v / c)^β), com α = 0,15 e β = 4.
 * Um troço vazio demora o tempo base; a partir de ~70% da capacidade o tempo cresce depressa.
 *
 * Custo generalizado (em minutos equivalentes) para um condutor com valor do tempo VOT (€/h):
 *   custo = tempo + portagem / (VOT / 60)
 * ou seja, a portagem é convertida nos minutos que o condutor estaria disposto a "pagar" por ela.
 */

export const BPR_ALPHA = 0.15
export const BPR_BETA = 4

export function congestedTime(baseTimeMin: number, volume: number, capacity: number): number {
  if (capacity <= 0) return Number.POSITIVE_INFINITY
  return baseTimeMin * (1 + BPR_ALPHA * (Math.max(volume, 0) / capacity) ** BPR_BETA)
}

/** Chave de um troço num sentido (os volumes e tempos são por sentido). */
export function directedKey(edgeId: EdgeId, from: NodeId): string {
  return `${edgeId}>${from}`
}

/**
 * Portagem a pagar ao percorrer um troço (em qualquer sentido), para uma classe: soma das tarifas
 * dos pórticos ativos nesse troço. Regra de cobrança: por pórtico atravessado (D8).
 */
export function tollTableByEdge(tolls: readonly TollPoint[]): ReadonlyMap<EdgeId, Readonly<Record<VehicleClass, number>>> {
  const table = new Map<EdgeId, Record<VehicleClass, number>>()
  for (const toll of tolls) {
    if (!toll.active) continue
    const current = table.get(toll.edgeId) ?? { c1: 0, c2: 0, c3: 0, c4: 0 }
    table.set(toll.edgeId, {
      c1: current.c1 + toll.tariffCents.c1,
      c2: current.c2 + toll.tariffCents.c2,
      c3: current.c3 + toll.tariffCents.c3,
      c4: current.c4 + toll.tariffCents.c4,
    })
  }
  return table
}

/** Cêntimos por minuto que um condutor com este valor do tempo atribui ao seu tempo. */
export function centsPerMinute(valueOfTimeEurPerHour: number): number {
  return (valueOfTimeEurPerHour * 100) / 60
}

export function generalizedCost(timeMin: number, tollCents: number, valueOfTimeEurPerHour: number): number {
  const rate = centsPerMinute(valueOfTimeEurPerHour)
  // Um condutor com valor do tempo nulo evitaria qualquer portagem: custo infinito se houver portagem.
  if (rate <= 0) return tollCents > 0 ? Number.POSITIVE_INFINITY : timeMin
  return timeMin + tollCents / rate
}

export function edgeTime(edge: RoadEdge, volume: number): number {
  return congestedTime(edge.baseTimeMin, volume, edge.capacityVehPerHour)
}
