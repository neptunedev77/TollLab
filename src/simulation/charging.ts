import type { EdgeId, TollId, TollPoint, Vehicle, VehicleClass, VehicleId } from '../domain/types.ts'

/*
 * Cobrança de portagens.
 *
 * Regra (D8): cobrança POR PÓRTICO. Cada vez que um veículo atravessa um pórtico ativo que pertence
 * ao seu percurso, gera-se um evento de passagem com a tarifa da sua classe. Um pórtico num troço de
 * dois sentidos cobra nos dois sentidos.
 *
 * O livro de cobranças garante que:
 *  - cada travessia gera no máximo um evento (ID único: veículo + passo do percurso + pórtico);
 *  - não se cobra um pórtico inativo, inexistente ou que não esteja no passo indicado do percurso;
 *  - todos os totais são somas dos eventos registados (nunca estimativas paralelas).
 */

export interface Crossing {
  readonly vehicle: Vehicle
  /** Índice do passo do percurso em que o pórtico é atravessado. */
  readonly stepIndex: number
  readonly tollId: TollId
  /** Minuto da viagem em que a travessia acontece (desde a partida). */
  readonly atMinute?: number
}

export interface PassageEvent {
  readonly id: string
  readonly vehicleId: VehicleId
  readonly tollId: TollId
  readonly edgeId: EdgeId
  readonly vehicleClass: VehicleClass
  readonly tariffCents: number
  readonly stepIndex: number
  readonly atMinute: number | null
}

export type RejectionReason = 'unknown-toll' | 'inactive' | 'off-route' | 'duplicate'

export type RecordResult =
  | { readonly ok: true; readonly event: PassageEvent }
  | { readonly ok: false; readonly reason: RejectionReason }

export interface ChargeLedger {
  record(crossing: Crossing): RecordResult
  /**
   * Troca o estado dos pórticos (ex.: tarifa alterada durante a reprodução). As passagens já
   * registadas mantêm-se; as seguintes usam o estado novo. O controlo de duplicados continua.
   */
  setTolls(tolls: readonly TollPoint[]): void
  readonly events: readonly PassageEvent[]
}

export function passageEventId(vehicleId: VehicleId, stepIndex: number, tollId: TollId): string {
  return `${vehicleId}#${stepIndex}@${tollId}`
}

/** Livro de cobranças para um conjunto fixo de pórticos (o estado dos pórticos do período). */
export function createChargeLedger(tolls: readonly TollPoint[]): ChargeLedger {
  let tollsById = new Map(tolls.map((toll) => [toll.id, toll]))
  const seen = new Set<string>()
  const events: PassageEvent[] = []

  return {
    events,
    setTolls(next) {
      tollsById = new Map(next.map((toll) => [toll.id, toll]))
    },
    record({ vehicle, stepIndex, tollId, atMinute }) {
      const toll = tollsById.get(tollId)
      if (!toll) return { ok: false, reason: 'unknown-toll' }
      if (!toll.active) return { ok: false, reason: 'inactive' }
      const step = vehicle.route?.[stepIndex]
      if (!step || step.edgeId !== toll.edgeId) return { ok: false, reason: 'off-route' }
      const id = passageEventId(vehicle.id, stepIndex, tollId)
      if (seen.has(id)) return { ok: false, reason: 'duplicate' }
      seen.add(id)
      const event: PassageEvent = {
        id,
        vehicleId: vehicle.id,
        tollId,
        edgeId: toll.edgeId,
        vehicleClass: vehicle.vehicleClass,
        tariffCents: toll.tariffCents[vehicle.vehicleClass],
        stepIndex,
        atMinute: atMinute ?? null,
      }
      events.push(event)
      return { ok: true, event }
    },
  }
}

/**
 * Travessias de pórticos ao longo do percurso de um veículo, por ordem de passagem. No sentido
 * inverso de um troço, os pórticos são atravessados pela ordem inversa da sua posição.
 * `stepTimes` (opcional) dá a duração de cada passo para calcular o minuto da travessia.
 */
export function crossingsOf(
  vehicle: Vehicle,
  tolls: readonly TollPoint[],
  edgeFrom: ReadonlyMap<EdgeId, string>,
  stepTimes?: readonly number[],
): Crossing[] {
  const byEdge = new Map<EdgeId, TollPoint[]>()
  for (const toll of tolls) byEdge.set(toll.edgeId, [...(byEdge.get(toll.edgeId) ?? []), toll])

  const crossings: Crossing[] = []
  let elapsed = 0
  ;(vehicle.route ?? []).forEach((step, stepIndex) => {
    const duration = stepTimes?.[stepIndex] ?? 0
    const forward = edgeFrom.get(step.edgeId) === step.from
    const onEdge = (byEdge.get(step.edgeId) ?? [])
      .map((toll) => ({ toll, along: forward ? toll.position : 1 - toll.position }))
      .sort((a, b) => a.along - b.along)
    for (const { toll, along } of onEdge) {
      crossings.push({
        vehicle,
        stepIndex,
        tollId: toll.id,
        atMinute: stepTimes ? elapsed + along * duration : undefined,
      })
    }
    elapsed += duration
  })
  return crossings
}
