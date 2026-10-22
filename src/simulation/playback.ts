import type { NetworkDataset, TollPoint, Vehicle, VehicleId } from '../domain/types.ts'
import type { AssignmentResult } from './assignment.ts'
import { createChargeLedger, crossingsOf, type Crossing, type PassageEvent } from './charging.ts'
import { directedKey } from './costs.ts'
import { createMotionGeometry, prepareRoute, type MotionGeometry, type RouteMotion } from './motion.ts'
import { createRandom } from './random.ts'

/*
 * Reprodução no tempo de uma hora de procura.
 *
 *  - Cada veículo parte num minuto sorteado (semente) dentro da janela de procura de 60 min.
 *  - O motor avança em passos fixos (`STEP_MIN`), independentes da taxa de fotogramas. Em cada passo
 *    processa partidas, travessias de pórticos (registadas no livro de cobranças) e chegadas.
 *  - A posição de cada veículo é uma função contínua do tempo (`motion.ts`): o render pode pedi-la a
 *    qualquer instante entre passos, sem recalcular o motor.
 *  - Ao mudar o plano (pórticos/tarifas) durante a reprodução, os veículos já em viagem mantêm o
 *    seu percurso; só os que ainda não partiram adotam o percurso novo.
 */

export const STEP_MIN = 0.05
export const DEMAND_WINDOW_MIN = 60

interface TripPlan {
  readonly vehicle: Vehicle
  readonly motion: RouteMotion
  /** Travessias com o minuto relativo à partida, por ordem de passagem. */
  readonly crossings: readonly Crossing[]
}

interface VehicleState {
  readonly departMin: number
  plan: TripPlan | null
  /** Índice da próxima travessia por processar. */
  nextCrossing: number
  phase: 'waiting' | 'travelling' | 'arrived'
}

export interface PlaybackStats {
  readonly minute: number
  readonly departed: number
  readonly travelling: number
  readonly arrived: number
  /** Veículos sem percurso válido: nunca partem (não há teletransporte). */
  readonly noRoute: number
  readonly passages: number
  readonly grossCents: number
  readonly finished: boolean
}

export interface ActiveVehicle {
  readonly id: VehicleId
  readonly vehicle: Vehicle
  readonly motion: RouteMotion
  /** Minuto da viagem (desde a partida) no instante pedido. */
  readonly tripMinute: number
}

export interface Playback {
  readonly now: number
  /** Avança o motor até `minute` em passos fixos; devolve as passagens cobradas neste avanço. */
  advanceTo(minute: number): PassageEvent[]
  /** Atualiza pórticos e percursos para os veículos que ainda não partiram. */
  setPlan(assignment: AssignmentResult, tolls: readonly TollPoint[]): void
  reset(): void
  stats(): PlaybackStats
  readonly events: readonly PassageEvent[]
  /** Veículos em viagem no minuto `minute` (pode estar entre dois passos do motor). */
  activeAt(minute: number, every?: number): ActiveVehicle[]
  /** Minuto em que o último veículo chega (fim da reprodução). */
  readonly endMinute: number
}

function buildPlans(
  geometry: MotionGeometry,
  assignment: AssignmentResult,
  tolls: readonly TollPoint[],
): Map<VehicleId, TripPlan | null> {
  const plans = new Map<VehicleId, TripPlan | null>()
  for (const vehicle of assignment.vehicles) {
    if (!vehicle.route) {
      plans.set(vehicle.id, null)
      continue
    }
    const durations = vehicle.route.map((step) => assignment.flows.get(directedKey(step.edgeId, step.from))?.timeMin ?? 0)
    const motion = prepareRoute(geometry, vehicle.route, durations)
    plans.set(
      vehicle.id,
      motion ? { vehicle, motion, crossings: crossingsOf(vehicle, tolls, geometry.edgeFrom, durations) } : null,
    )
  }
  return plans
}

export function createPlayback(
  dataset: NetworkDataset,
  assignment: AssignmentResult,
  tolls: readonly TollPoint[],
  seed: number,
): Playback {
  const geometry = createMotionGeometry(dataset)
  const random = createRandom(seed ^ 0x51ed270b)
  // A ordem dos veículos (e portanto as partidas) depende só da procura e da semente.
  const departures = new Map(assignment.vehicles.map((vehicle) => [vehicle.id, random.next() * DEMAND_WINDOW_MIN]))

  let ledger = createChargeLedger(tolls)
  let currentTolls = tolls
  let currentAssignment = assignment
  let plans = buildPlans(geometry, assignment, tolls)
  // Ordinal estável de cada veículo, para a amostragem de desenho não mudar com o tempo.
  const ordinal = new Map(assignment.vehicles.map((vehicle, index) => [vehicle.id, index]))
  let cachedEnd = DEMAND_WINDOW_MIN
  let states = new Map<VehicleId, VehicleState>()
  let order: VehicleId[] = []
  let now = 0

  const init = () => {
    ledger = createChargeLedger(currentTolls)
    states = new Map()
    for (const vehicle of currentAssignment.vehicles) {
      states.set(vehicle.id, { departMin: departures.get(vehicle.id) ?? 0, plan: plans.get(vehicle.id) ?? null, nextCrossing: 0, phase: 'waiting' })
    }
    order = [...states.keys()].sort((a, b) => (states.get(a)?.departMin ?? 0) - (states.get(b)?.departMin ?? 0))
    now = 0
    refreshEnd()
  }

  function refreshEnd() {
    let end = DEMAND_WINDOW_MIN
    for (const state of states.values()) if (state.plan) end = Math.max(end, state.departMin + state.plan.motion.durationMin)
    cachedEnd = end
  }
  const endMinute = () => cachedEnd
  init()

  const step = (to: number, recorded: PassageEvent[]) => {
    for (const id of order) {
      const state = states.get(id)
      if (!state || state.phase === 'arrived') continue
      if (state.departMin > to) break // `order` está ordenado por partida
      if (!state.plan) continue // sem percurso: fica na origem
      state.phase = 'travelling'
      const tripMinute = to - state.departMin
      while (state.nextCrossing < state.plan.crossings.length) {
        const crossing = state.plan.crossings[state.nextCrossing] as Crossing
        if ((crossing.atMinute ?? 0) > tripMinute) break
        const result = ledger.record(crossing)
        if (result.ok) recorded.push(result.event)
        state.nextCrossing++
      }
      if (tripMinute >= state.plan.motion.durationMin) state.phase = 'arrived'
    }
  }

  return {
    get now() {
      return now
    },
    get events() {
      return ledger.events
    },
    get endMinute() {
      return endMinute()
    },
    advanceTo(minute) {
      const recorded: PassageEvent[] = []
      const end = endMinute()
      const target = Math.min(minute, end)
      while (now + STEP_MIN <= target + 1e-9) {
        now = Math.round((now + STEP_MIN) * 1e6) / 1e6
        step(now, recorded)
      }
      // Último passo (parcial) até ao fim exato, para todos os veículos chegarem. Nunca passa de `minute`.
      if (minute >= end && now < end) {
        now = end
        step(now, recorded)
      }
      return recorded
    },
    setPlan(nextAssignment, nextTolls) {
      currentTolls = nextTolls
      currentAssignment = nextAssignment
      ledger.setTolls(nextTolls)
      plans = buildPlans(geometry, nextAssignment, nextTolls)
      for (const [id, state] of states) {
        if (state.phase === 'waiting') state.plan = plans.get(id) ?? null
      }
      refreshEnd()
    },
    reset() {
      plans = buildPlans(geometry, currentAssignment, currentTolls)
      init()
    },
    stats() {
      let departed = 0
      let travelling = 0
      let arrived = 0
      let noRoute = 0
      for (const state of states.values()) {
        if (!state.plan) {
          noRoute++
          continue
        }
        if (state.phase !== 'waiting') departed++
        if (state.phase === 'travelling') travelling++
        if (state.phase === 'arrived') arrived++
      }
      const grossCents = ledger.events.reduce((sum, event) => sum + event.tariffCents, 0)
      return { minute: now, departed, travelling, arrived, noRoute, passages: ledger.events.length, grossCents, finished: now >= endMinute() - 1e-9 }
    },
    activeAt(minute, every = 1) {
      const active: ActiveVehicle[] = []
      for (const id of order) {
        const state = states.get(id)
        if (!state) continue
        if (state.departMin > minute) break
        if (!state.plan) continue
        const tripMinute = minute - state.departMin
        if (tripMinute > state.plan.motion.durationMin) continue
        // Amostragem estável: o mesmo veículo é sempre desenhado (ou não), sem cintilação.
        if ((ordinal.get(id) ?? 0) % every !== 0) continue
        active.push({ id, vehicle: state.plan.vehicle, motion: state.plan.motion, tripMinute })
      }
      return active
    },
  }
}
