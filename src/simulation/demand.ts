import { VEHICLE_CLASSES, type DemandSpec, type RoadNetwork, type Vehicle } from '../domain/types.ts'
import type { ValidationIssue, ValidationResult } from '../domain/validation.ts'
import { createRandom } from './random.ts'

/** Variação controlada do valor do tempo de cada condutor em torno do valor do seu perfil (±15%). */
export const VALUE_OF_TIME_JITTER = 0.15
/** Teto de viagens por hora de um par origem–destino (protege o desempenho contra erros nos dados). */
export const MAX_TRIPS_PER_PAIR = 5000

const SHARE_TOLERANCE = 1e-6

/**
 * Invariantes da procura: pares com nós existentes e distintos, viagens inteiras em [0, máximo],
 * perfis com IDs únicos, valor do tempo positivo e quotas que somam 1, e quotas de classe que somam 1.
 */
export function validateDemand(network: RoadNetwork, demand: DemandSpec): ValidationResult {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(network.nodes.map((node) => node.id))

  demand.odPairs.forEach((pair, index) => {
    const path = `demand.odPairs[${index}]`
    for (const end of ['originId', 'destinationId'] as const) {
      if (!nodeIds.has(pair[end])) {
        issues.push({ code: 'unknown-node', path: `${path}.${end}`, message: `A procura refere o nó inexistente "${pair[end]}".` })
      }
    }
    if (pair.originId === pair.destinationId) {
      issues.push({ code: 'self-loop', path, message: `A procura tem viagens de "${pair.originId}" para si próprio.` })
    }
    if (!Number.isInteger(pair.tripsPerHour) || pair.tripsPerHour < 0 || pair.tripsPerHour > MAX_TRIPS_PER_PAIR) {
      issues.push({
        code: 'invalid-number',
        path: `${path}.tripsPerHour`,
        message: `As viagens por hora têm de ser um inteiro entre 0 e ${MAX_TRIPS_PER_PAIR}.`,
      })
    }
  })

  const profileIds = new Set<string>()
  demand.profiles.forEach((profile, index) => {
    if (profileIds.has(profile.id)) {
      issues.push({ code: 'duplicate-id', path: 'demand.profiles', message: `O perfil "${profile.id}" está repetido.` })
    }
    profileIds.add(profile.id)
    if (!(Number.isFinite(profile.valueOfTimeEurPerHour) && profile.valueOfTimeEurPerHour > 0)) {
      issues.push({
        code: 'invalid-number',
        path: `demand.profiles[${index}].valueOfTimeEurPerHour`,
        message: `O valor do tempo do perfil "${profile.name}" tem de ser positivo.`,
      })
    }
  })

  const shareSum = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0)
  const validShares = (values: readonly number[]) =>
    values.every((value) => Number.isFinite(value) && value >= 0) && Math.abs(shareSum(values) - 1) < SHARE_TOLERANCE

  if (demand.profiles.length === 0 || !validShares(demand.profiles.map((profile) => profile.share))) {
    issues.push({ code: 'invalid-number', path: 'demand.profiles', message: 'As quotas dos perfis têm de somar 1.' })
  }
  if (!validShares(VEHICLE_CLASSES.map((vehicleClass) => demand.classShares[vehicleClass]))) {
    issues.push({ code: 'invalid-number', path: 'demand.classShares', message: 'As quotas das classes têm de somar 1.' })
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export type VehicleRequest = Omit<Vehicle, 'route' | 'status'>

/**
 * Gera os veículos de uma hora de procura. Para cada viagem sorteia a classe e o perfil (pelas
 * quotas) e um valor do tempo com variação controlada. Mesma procura e semente → mesmos veículos.
 */
export function generateVehicles(demand: DemandSpec, seed: number): VehicleRequest[] {
  const random = createRandom(seed)
  const classWeights = VEHICLE_CLASSES.map((vehicleClass) => demand.classShares[vehicleClass])
  const profileWeights = demand.profiles.map((profile) => profile.share)
  const vehicles: VehicleRequest[] = []

  for (const pair of demand.odPairs) {
    for (let trip = 0; trip < pair.tripsPerHour; trip++) {
      const vehicleClass = VEHICLE_CLASSES[random.weightedIndex(classWeights)] ?? 'c1'
      const profile = demand.profiles[random.weightedIndex(profileWeights)]
      if (!profile) continue
      const jitter = random.between(1 - VALUE_OF_TIME_JITTER, 1 + VALUE_OF_TIME_JITTER)
      vehicles.push({
        id: `v${vehicles.length + 1}`,
        originId: pair.originId,
        destinationId: pair.destinationId,
        vehicleClass,
        profileId: profile.id,
        // Arredondado a 0,1 €/h: suficiente para a variação e permite reutilizar percursos já calculados.
        valueOfTimeEurPerHour: Math.round(profile.valueOfTimeEurPerHour * jitter * 10) / 10,
      })
    }
  }
  return vehicles
}
