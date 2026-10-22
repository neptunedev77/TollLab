import { VEHICLE_CLASSES, type DemandSpec, type NetworkDataset, type TollPoint } from '../domain/types.ts'
import { validateTolls } from '../domain/validation.ts'
import { validateDemand } from '../simulation/demand.ts'
import { isolatedCopy, runScenario, SCENARIO_SCHEMA_VERSION, type Scenario, type ScenarioResults } from './scenario.ts'

/*
 * Persistência local dos cenários (localStorage), com envelope versionado:
 *   { app: "tolllab", version: 2, scenarios: Scenario[] }
 *
 * Versões:
 *  - 1: formato antigo { version: 1, items: [{ id, name, savedAt, tolls, seed }] }, sem procura nem
 *       resultados. É migrado: usa a procura por omissão e recalcula os resultados com o motor.
 *  - 2: formato atual.
 *
 * Nunca lança exceções nem bloqueia o arranque: dados corrompidos são guardados numa chave de backup
 * e ignorados; cenários inválidos são descartados com aviso; uma versão mais recente do que a
 * aplicação é deixada intacta e a gravação fica bloqueada para não a sobrescrever.
 */

export const STORAGE_KEY = 'tolllab:scenarios'
export const BACKUP_KEY = 'tolllab:scenarios:corrupted'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface LoadResult {
  readonly scenarios: readonly Scenario[]
  readonly warnings: readonly string[]
  /** `false` quando gravar apagaria dados que esta versão não sabe ler. */
  readonly canSave: boolean
}

export interface LoadContext {
  readonly dataset: NetworkDataset
  readonly defaultDemand: DemandSpec
  readonly now?: () => Date
}

/** `localStorage` quando existe e funciona (pode estar bloqueado, ex.: modo privado); senão `null`. */
export function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = '__tolllab_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function looksLikeToll(value: unknown): value is TollPoint {
  if (!isRecord(value) || !isRecord(value.tariffCents)) return false
  const tariff = value.tariffCents
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.edgeId) &&
    isFiniteNumber(value.position) &&
    typeof value.active === 'boolean' &&
    VEHICLE_CLASSES.every((vehicleClass) => isFiniteNumber(tariff[vehicleClass]))
  )
}

function looksLikeDemand(value: unknown): value is DemandSpec {
  return isRecord(value) && Array.isArray(value.odPairs) && Array.isArray(value.profiles) && isRecord(value.classShares)
}

function looksLikeResults(value: unknown): value is ScenarioResults {
  return (
    isRecord(value) &&
    isString(value.computedAt) &&
    ['vehicles', 'routed', 'noRoute', 'payingVehicles', 'avoidingTolls', 'passages', 'grossCents', 'totalCostCents', 'netCents'].every(
      (key) => isFiniteNumber(value[key]),
    ) &&
    (value.averageTimeMin === null || isFiniteNumber(value.averageTimeMin)) &&
    isRecord(value.byToll)
  )
}

/** Valida e normaliza um cenário lido; devolve o cenário ou a razão para o recusar. */
function readScenario(raw: unknown, context: LoadContext): Scenario | string {
  if (!isRecord(raw) || !isString(raw.id) || !isString(raw.name)) return 'formato desconhecido'
  if (raw.datasetId !== context.dataset.id) return 'pertence a outra rede'
  if (!Array.isArray(raw.tolls) || !raw.tolls.every(looksLikeToll)) return 'pórticos com formato inválido'
  if (!looksLikeDemand(raw.demand)) return 'procura com formato inválido'
  if (!Number.isInteger(raw.seed)) return 'semente inválida'

  const tolls = raw.tolls as TollPoint[]
  const demand = raw.demand as DemandSpec
  const seed = raw.seed as number
  const tollCheck = validateTolls(context.dataset.network, tolls)
  if (!tollCheck.ok) return tollCheck.issues[0]?.message ?? 'pórticos inválidos'
  const demandCheck = validateDemand(context.dataset.network, demand)
  if (!demandCheck.ok) return demandCheck.issues[0]?.message ?? 'procura inválida'

  const now = context.now ?? (() => new Date())
  const timestamp = isString(raw.updatedAt) ? raw.updatedAt : now().toISOString()
  return isolatedCopy({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: raw.id,
    name: raw.name.trim() || 'Cenário sem nome',
    createdAt: isString(raw.createdAt) ? raw.createdAt : timestamp,
    updatedAt: timestamp,
    datasetId: context.dataset.id,
    tolls,
    demand,
    seed,
    // Resultados em falta ou estragados são recalculados com o motor (são determinísticos).
    results: looksLikeResults(raw.results) ? raw.results : runScenario(context.dataset, tolls, demand, seed, undefined, now),
  })
}

/** Migra o formato v1 para registos no formato v2 (ainda por validar). */
function migrateV1(items: unknown[], context: LoadContext): unknown[] {
  return items.map((item) => {
    if (!isRecord(item)) return item
    return {
      id: item.id,
      name: item.name,
      createdAt: item.savedAt,
      updatedAt: item.savedAt,
      datasetId: context.dataset.id,
      tolls: item.tolls,
      demand: context.defaultDemand,
      seed: item.seed,
    }
  })
}

export function loadScenarios(storage: KeyValueStorage | null, context: LoadContext): LoadResult {
  if (!storage) return { scenarios: [], warnings: ['O armazenamento local não está disponível: os cenários não serão guardados.'], canSave: false }

  let text: string | null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return { scenarios: [], warnings: ['Não foi possível ler os cenários guardados.'], canSave: false }
  }
  if (text === null) return { scenarios: [], warnings: [], canSave: true }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    try {
      storage.setItem(BACKUP_KEY, text)
    } catch {
      // Sem espaço para a cópia de segurança: os dados ficam como estão até à próxima gravação.
    }
    return { scenarios: [], warnings: ['Os cenários guardados estavam corrompidos e foram ignorados (há uma cópia de segurança).'], canSave: true }
  }

  if (!isRecord(parsed) || !isFiniteNumber(parsed.version)) {
    return { scenarios: [], warnings: ['Os dados guardados não são de cenários do TollLab e foram ignorados.'], canSave: true }
  }
  if (parsed.version > SCENARIO_SCHEMA_VERSION) {
    return {
      scenarios: [],
      warnings: ['Os cenários foram guardados por uma versão mais recente do TollLab e não podem ser lidos aqui.'],
      canSave: false,
    }
  }

  let records: unknown[]
  const warnings: string[] = []
  if (parsed.version === 1 && Array.isArray(parsed.items)) {
    records = migrateV1(parsed.items, context)
    warnings.push('Os cenários foram convertidos de uma versão anterior.')
  } else if (parsed.version === SCENARIO_SCHEMA_VERSION && Array.isArray(parsed.scenarios)) {
    records = parsed.scenarios
  } else {
    return { scenarios: [], warnings: ['O formato dos cenários guardados não é reconhecido.'], canSave: true }
  }

  const scenarios: Scenario[] = []
  const ids = new Set<string>()
  records.forEach((raw, index) => {
    const result = readScenario(raw, context)
    const label = isRecord(raw) && isString(raw.name) ? `"${raw.name}"` : `n.º ${index + 1}`
    if (typeof result === 'string') {
      warnings.push(`O cenário ${label} foi ignorado: ${result}.`)
    } else if (ids.has(result.id)) {
      warnings.push(`O cenário ${label} foi ignorado: ID repetido.`)
    } else {
      ids.add(result.id)
      scenarios.push(result)
    }
  })
  return { scenarios, warnings, canSave: true }
}

export type SaveResult = { readonly ok: true } | { readonly ok: false; readonly message: string }

export function saveScenarios(storage: KeyValueStorage | null, scenarios: readonly Scenario[]): SaveResult {
  if (!storage) return { ok: false, message: 'O armazenamento local não está disponível.' }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ app: 'tolllab', version: SCENARIO_SCHEMA_VERSION, scenarios }))
    return { ok: true }
  } catch {
    return { ok: false, message: 'Não foi possível guardar os cenários (armazenamento cheio ou bloqueado).' }
  }
}
