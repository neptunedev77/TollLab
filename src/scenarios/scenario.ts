import type { DemandSpec, NetworkDataset, TollId, TollPoint } from '../domain/types.ts'
import { assignTraffic } from '../simulation/assignment.ts'
import { chargePeriod, DEMO_COST_MODEL, type CostModel } from '../simulation/economics.ts'

/*
 * Cenários: configurações independentes e reprodutíveis.
 *
 * Um cenário guarda a rede (pelo ID do conjunto de dados — a rede não é editável na aplicação),
 * os pórticos com as tarifas, a procura, a semente e os resultados do motor. Cada cenário é uma cópia
 * profunda e congelada: nenhuma edição posterior (nem de outro cenário) o pode alterar.
 */

export const SCENARIO_SCHEMA_VERSION = 2

export interface ScenarioResults {
  readonly computedAt: string
  readonly vehicles: number
  readonly routed: number
  readonly noRoute: number
  readonly averageTimeMin: number | null
  readonly payingVehicles: number
  readonly avoidingTolls: number
  readonly passages: number
  readonly grossCents: number
  readonly totalCostCents: number
  readonly netCents: number
  readonly byToll: Readonly<Record<TollId, { readonly passages: number; readonly grossCents: number }>>
}

export interface Scenario {
  readonly schemaVersion: typeof SCENARIO_SCHEMA_VERSION
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly datasetId: string
  readonly tolls: readonly TollPoint[]
  readonly demand: DemandSpec
  readonly seed: number
  readonly results: ScenarioResults
}

export interface ScenarioInput {
  readonly name: string
  readonly tolls: readonly TollPoint[]
  readonly demand: DemandSpec
  readonly seed: number
}

/** Congela recursivamente um valor (as cópias guardadas tornam-se imutáveis em tempo de execução). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** Cópia profunda e congelada: nunca partilha objetos com a origem. */
export function isolatedCopy<T>(value: T): T {
  return deepFreeze(structuredClone(value))
}

/** Executa o motor (afetação + cobrança) para uma configuração e resume os resultados. */
export function runScenario(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  demand: DemandSpec,
  seed: number,
  costs: CostModel = DEMO_COST_MODEL,
  now: () => Date = () => new Date(),
): ScenarioResults {
  const assignment = assignTraffic(dataset, tolls, demand, { seed })
  const { report } = chargePeriod(dataset, tolls, assignment, costs)
  return {
    computedAt: now().toISOString(),
    vehicles: assignment.summary.vehicles,
    routed: assignment.summary.routed,
    noRoute: assignment.summary.noRoute,
    averageTimeMin: assignment.summary.averageTimeMin,
    payingVehicles: report.payingVehicles,
    avoidingTolls: assignment.summary.avoidingTolls,
    passages: report.passages,
    grossCents: report.grossCents,
    totalCostCents: report.totalCostCents,
    netCents: report.netCents,
    byToll: Object.fromEntries([...report.byToll].map(([id, toll]) => [id, { passages: toll.passages, grossCents: toll.grossCents }])),
  }
}

let counter = 0
/** ID único e estável o suficiente para armazenamento local. */
export function newScenarioId(now: () => number = Date.now): string {
  counter = (counter + 1) % 1_000_000
  return `sc-${now().toString(36)}-${counter.toString(36)}`
}

export function createScenario(
  dataset: NetworkDataset,
  input: ScenarioInput,
  options: { id?: string; now?: () => Date } = {},
): Scenario {
  const now = options.now ?? (() => new Date())
  const timestamp = now().toISOString()
  return isolatedCopy({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: options.id ?? newScenarioId(),
    name: input.name.trim() || 'Cenário sem nome',
    createdAt: timestamp,
    updatedAt: timestamp,
    datasetId: dataset.id,
    tolls: input.tolls,
    demand: input.demand,
    seed: input.seed,
    results: runScenario(dataset, input.tolls, input.demand, input.seed, DEMO_COST_MODEL, now),
  })
}

/** Atualiza a configuração de um cenário existente (novo objeto; o anterior não muda). */
export function updateScenario(
  dataset: NetworkDataset,
  scenario: Scenario,
  input: Partial<ScenarioInput>,
  now: () => Date = () => new Date(),
): Scenario {
  const tolls = input.tolls ?? scenario.tolls
  const demand = input.demand ?? scenario.demand
  const seed = input.seed ?? scenario.seed
  const rerun = input.tolls !== undefined || input.demand !== undefined || input.seed !== undefined
  return isolatedCopy({
    ...scenario,
    name: input.name === undefined ? scenario.name : input.name.trim() || scenario.name,
    updatedAt: now().toISOString(),
    tolls,
    demand,
    seed,
    results: rerun ? runScenario(dataset, tolls, demand, seed, DEMO_COST_MODEL, now) : scenario.results,
  })
}

export function duplicateScenario(scenario: Scenario, name: string, options: { id?: string; now?: () => Date } = {}): Scenario {
  const timestamp = (options.now ?? (() => new Date()))().toISOString()
  return isolatedCopy({
    ...structuredClone(scenario),
    id: options.id ?? newScenarioId(),
    name: name.trim() || `${scenario.name} (cópia)`,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

/** Nome livre seguinte do tipo "Cenário N". */
export function nextScenarioName(scenarios: readonly Scenario[], base = 'Cenário'): string {
  const names = new Set(scenarios.map((scenario) => scenario.name))
  let index = scenarios.length + 1
  while (names.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}

/** Compara a configuração atual com a de um cenário (para saber se há alterações por guardar). */
export function sameConfiguration(
  scenario: Pick<Scenario, 'tolls' | 'demand' | 'seed'>,
  current: { tolls: readonly TollPoint[]; demand: DemandSpec; seed: number },
): boolean {
  return (
    scenario.seed === current.seed &&
    JSON.stringify(scenario.tolls) === JSON.stringify(current.tolls) &&
    JSON.stringify(scenario.demand) === JSON.stringify(current.demand)
  )
}

/** `base` se estiver livre; senão `base (2)`, `base (3)`, … */
export function uniqueScenarioName(scenarios: readonly Scenario[], base: string): string {
  const names = new Set(scenarios.map((scenario) => scenario.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} (${index})`)) index++
  return `${base} (${index})`
}
