import { VEHICLE_CLASSES, type EdgeId, type NetworkDataset, type TollId, type TollPoint, type VehicleClass } from '../domain/types.ts'
import type { AssignmentResult } from './assignment.ts'
import { createChargeLedger, crossingsOf, type PassageEvent, type RejectionReason } from './charging.ts'
import { directedKey } from './costs.ts'

/*
 * Receitas, custos e resultado do período simulado (uma hora de procura).
 *
 *  - Receita bruta: soma das tarifas de todos os eventos de passagem registados. Não é lucro.
 *  - Custos estimados (modelo ILUSTRATIVO, não dados reais):
 *      · custo fixo por pórtico instalado e por hora (amortização da instalação + manutenção),
 *        pago mesmo que o pórtico esteja inativo;
 *      · custo de cobrança por passagem (processamento da transação).
 *  - Resultado líquido estimado = receita bruta − custos estimados (pode ser negativo).
 */

export interface CostModel {
  readonly fixedCentsPerGantryHour: number
  readonly collectionCentsPerPassage: number
}

/** Valores ilustrativos do modelo de demonstração. */
export const DEMO_COST_MODEL: CostModel = { fixedCentsPerGantryHour: 2500, collectionCentsPerPassage: 8 }

export interface TollRevenue {
  readonly passages: number
  readonly grossCents: number
  readonly fixedCostCents: number
  readonly collectionCostCents: number
  readonly netCents: number
}

export interface RevenueReport {
  readonly passages: number
  /** Veículos distintos com pelo menos uma passagem cobrada. */
  readonly payingVehicles: number
  readonly grossCents: number
  readonly fixedCostCents: number
  readonly collectionCostCents: number
  readonly totalCostCents: number
  readonly netCents: number
  readonly byToll: ReadonlyMap<TollId, TollRevenue>
  readonly byClass: Readonly<Record<VehicleClass, { readonly passages: number; readonly grossCents: number }>>
  readonly byEdge: ReadonlyMap<EdgeId, number>
  /** Travessias recusadas pelo livro, por motivo (ex.: pórtico inativo → passagem gratuita). */
  readonly rejected: Readonly<Record<RejectionReason, number>>
}

export interface ChargingResult {
  readonly events: readonly PassageEvent[]
  readonly report: RevenueReport
}

/** Agrega eventos de passagem. Todos os totais são somas destes eventos. */
export function summarizeRevenue(
  events: readonly PassageEvent[],
  tolls: readonly TollPoint[],
  costs: CostModel,
  rejected: Readonly<Record<RejectionReason, number>> = { 'unknown-toll': 0, inactive: 0, 'off-route': 0, duplicate: 0 },
): RevenueReport {
  const perToll = new Map<TollId, { passages: number; grossCents: number }>(tolls.map((toll) => [toll.id, { passages: 0, grossCents: 0 }]))
  const byClass = Object.fromEntries(VEHICLE_CLASSES.map((c) => [c, { passages: 0, grossCents: 0 }])) as Record<
    VehicleClass,
    { passages: number; grossCents: number }
  >
  const byEdge = new Map<EdgeId, number>()
  const payers = new Set<string>()
  let grossCents = 0

  for (const event of events) {
    grossCents += event.tariffCents
    payers.add(event.vehicleId)
    const toll = perToll.get(event.tollId) ?? { passages: 0, grossCents: 0 }
    perToll.set(event.tollId, { passages: toll.passages + 1, grossCents: toll.grossCents + event.tariffCents })
    byClass[event.vehicleClass].passages++
    byClass[event.vehicleClass].grossCents += event.tariffCents
    byEdge.set(event.edgeId, (byEdge.get(event.edgeId) ?? 0) + event.tariffCents)
  }

  const byToll = new Map<TollId, TollRevenue>()
  let fixedCostCents = 0
  let collectionCostCents = 0
  for (const [tollId, totals] of perToll) {
    const fixed = costs.fixedCentsPerGantryHour
    const collection = totals.passages * costs.collectionCentsPerPassage
    fixedCostCents += fixed
    collectionCostCents += collection
    byToll.set(tollId, {
      ...totals,
      fixedCostCents: fixed,
      collectionCostCents: collection,
      netCents: totals.grossCents - fixed - collection,
    })
  }

  const totalCostCents = fixedCostCents + collectionCostCents
  return {
    passages: events.length,
    payingVehicles: payers.size,
    grossCents,
    fixedCostCents,
    collectionCostCents,
    totalCostCents,
    netCents: grossCents - totalCostCents,
    byToll,
    byClass,
    byEdge,
    rejected,
  }
}

/**
 * Cobra o período: percorre o percurso de cada veículo, regista no livro cada travessia de pórtico
 * (com o minuto em que acontece, pelos tempos com congestionamento) e agrega os eventos aceites.
 */
export function chargePeriod(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  assignment: AssignmentResult,
  costs: CostModel = DEMO_COST_MODEL,
): ChargingResult {
  const ledger = createChargeLedger(tolls)
  const edgeFrom = new Map(dataset.network.edges.map((edge) => [edge.id, edge.from]))
  const rejected: Record<RejectionReason, number> = { 'unknown-toll': 0, inactive: 0, 'off-route': 0, duplicate: 0 }

  for (const vehicle of assignment.vehicles) {
    if (!vehicle.route) continue
    const stepTimes = vehicle.route.map((step) => assignment.flows.get(directedKey(step.edgeId, step.from))?.timeMin ?? 0)
    for (const crossing of crossingsOf(vehicle, tolls, edgeFrom, stepTimes)) {
      const result = ledger.record(crossing)
      if (!result.ok) rejected[result.reason]++
    }
  }

  return { events: ledger.events, report: summarizeRevenue(ledger.events, tolls, costs, rejected) }
}
