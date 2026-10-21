import { edgeCurve, projectOntoPolyline } from './geometry.ts'
import { checkTariffCents } from './money.ts'
import { nodeName } from './summary.ts'
import type { EdgeId, NetworkDataset, RoadEdge, SchematicPoint, TariffTable, TollId, TollPoint, VehicleClass } from './types.ts'
import { MIN_TOLL_SPACING, validateTolls } from './validation.ts'

/*
 * Operações de edição de pórticos. Funções puras: recebem a lista atual e devolvem uma lista nova
 * (nunca alteram a original), ou um erro compreensível. Cada resultado é revalidado com
 * `validateTolls`, por isso não é possível obter um pórtico solto, duplicado, num troço inexistente
 * ou com tarifa inválida.
 */

/** Distância mínima (fração do troço) entre um pórtico e as extremidades do troço. */
export const EDGE_END_MARGIN = 0.04

/** Tarifa por omissão de um pórtico novo: 1,50 € na classe 1 e os mesmos múltiplos da rede de demonstração. */
export const DEFAULT_TARIFF: TariffTable = { c1: 150, c2: 263, c3: 338, c4: 375 }

export type TollEdit =
  | { readonly ok: true; readonly tolls: readonly TollPoint[]; readonly toll: TollPoint }
  | { readonly ok: false; readonly message: string }

const fail = (message: string): TollEdit => ({ ok: false, message })

export function clampPosition(position: number): number {
  return Math.min(Math.max(position, EDGE_END_MARGIN), 1 - EDGE_END_MARGIN)
}

function findEdge(dataset: NetworkDataset, edgeId: EdgeId): RoadEdge | undefined {
  return dataset.network.edges.find((edge) => edge.id === edgeId)
}

function finish(dataset: NetworkDataset, tolls: readonly TollPoint[], toll: TollPoint): TollEdit {
  const check = validateTolls(dataset.network, tolls)
  if (check.ok) return { ok: true, tolls, toll }
  const spacing = check.issues.find((issue) => issue.code === 'duplicate-toll-position')
  if (spacing) return fail('Já existe um pórtico muito perto deste ponto do troço.')
  return fail(check.issues[0]?.message ?? 'A alteração não é válida.')
}

/** Ponto livre no meio do maior intervalo do troço, ou `null` se o troço já não tiver espaço. */
export function freePositionOnEdge(tolls: readonly TollPoint[], edgeId: EdgeId): number | null {
  const taken = tolls
    .filter((toll) => toll.edgeId === edgeId)
    .map((toll) => toll.position)
    .sort((a, b) => a - b)
  const stops = [EDGE_END_MARGIN - MIN_TOLL_SPACING, ...taken, 1 - EDGE_END_MARGIN + MIN_TOLL_SPACING]
  let best: { start: number; end: number } | null = null
  for (let index = 1; index < stops.length; index++) {
    const start = stops[index - 1] as number
    const end = stops[index] as number
    if (!best || end - start > best.end - best.start) best = { start, end }
  }
  if (!best || best.end - best.start < MIN_TOLL_SPACING * 2) return null
  return clampPosition((best.start + best.end) / 2)
}

function nextTollId(tolls: readonly TollPoint[]): TollId {
  const ids = new Set(tolls.map((toll) => toll.id))
  let counter = tolls.length + 1
  while (ids.has(`toll-${counter}`)) counter++
  return `toll-${counter}`
}

function uniqueName(tolls: readonly TollPoint[], base: string): string {
  const names = new Set(tolls.map((toll) => toll.name))
  if (!names.has(base)) return base
  let counter = 2
  while (names.has(`${base} (${counter})`)) counter++
  return `${base} (${counter})`
}

export interface AddTollInput {
  readonly edgeId: EdgeId
  /** Fração do troço; se faltar, usa o maior espaço livre. */
  readonly position?: number
  readonly tariffCents?: TariffTable
}

export function addToll(dataset: NetworkDataset, tolls: readonly TollPoint[], input: AddTollInput): TollEdit {
  const edge = findEdge(dataset, input.edgeId)
  if (!edge) return fail('Só é possível colocar pórticos em troços da rede.')
  const position = input.position === undefined ? freePositionOnEdge(tolls, edge.id) : clampPosition(input.position)
  if (position === null || !Number.isFinite(position)) return fail('Este troço já não tem espaço livre para mais um pórtico.')

  const toll: TollPoint = {
    id: nextTollId(tolls),
    name: uniqueName(tolls, `Pórtico ${edge.ref} ${nodeName(dataset, edge.from)} – ${nodeName(dataset, edge.to)}`),
    edgeId: edge.id,
    position,
    active: true,
    tariffCents: input.tariffCents ?? DEFAULT_TARIFF,
  }
  return finish(dataset, [...tolls, toll], toll)
}

function update(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  id: TollId,
  change: (toll: TollPoint) => TollPoint | string,
): TollEdit {
  const current = tolls.find((toll) => toll.id === id)
  if (!current) return fail('O pórtico já não existe.')
  const next = change(current)
  if (typeof next === 'string') return fail(next)
  return finish(
    dataset,
    tolls.map((toll) => (toll.id === id ? next : toll)),
    next,
  )
}

/** Move um pórtico para uma posição de um troço (o mesmo ou outro), mantendo-o ancorado à rede. */
export function moveToll(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  id: TollId,
  edgeId: EdgeId,
  position: number,
): TollEdit {
  if (!findEdge(dataset, edgeId)) return fail('Só é possível colocar pórticos em troços da rede.')
  if (!Number.isFinite(position)) return fail('A posição no troço não é válida.')
  return update(dataset, tolls, id, (toll) => ({ ...toll, edgeId, position: clampPosition(position) }))
}

export function setTollActive(dataset: NetworkDataset, tolls: readonly TollPoint[], id: TollId, active: boolean): TollEdit {
  return update(dataset, tolls, id, (toll) => ({ ...toll, active }))
}

export function setTollTariff(
  dataset: NetworkDataset,
  tolls: readonly TollPoint[],
  id: TollId,
  vehicleClass: VehicleClass,
  cents: number,
): TollEdit {
  const check = checkTariffCents(cents)
  if (!check.ok) return fail(check.message)
  return update(dataset, tolls, id, (toll) => ({ ...toll, tariffCents: { ...toll.tariffCents, [vehicleClass]: check.cents } }))
}

export function removeToll(tolls: readonly TollPoint[], id: TollId): readonly TollPoint[] {
  return tolls.filter((toll) => toll.id !== id)
}

export interface SnapResult {
  readonly edgeId: EdgeId
  readonly position: number
  readonly point: SchematicPoint
  readonly distance: number
}

/**
 * Encaixa um ponto do mapa no troço mais próximo (de entre os permitidos), dentro de
 * `maxDistance` unidades. Devolve a fração do troço já limitada às margens das extremidades.
 */
export function snapToNetwork(
  dataset: NetworkDataset,
  target: SchematicPoint,
  maxDistance: number,
  allowEdge: (edge: RoadEdge) => boolean = () => true,
): SnapResult | null {
  let best: SnapResult | null = null
  for (const edge of dataset.network.edges) {
    if (!allowEdge(edge)) continue
    const curve = edgeCurve(dataset, edge.id)
    if (!curve) continue
    const hit = projectOntoPolyline(curve, target)
    if (hit && hit.distance <= maxDistance && (!best || hit.distance < best.distance)) {
      best = { edgeId: edge.id, position: clampPosition(hit.t), point: hit.point, distance: hit.distance }
    }
  }
  return best
}
