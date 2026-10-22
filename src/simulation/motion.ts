import { edgeCurve } from '../domain/geometry.ts'
import type { EdgeId, NetworkDataset, RouteStep, SchematicPoint } from '../domain/types.ts'

/*
 * Movimento dos veículos: posição e orientação são funções analíticas do tempo, ao longo da mesma
 * geometria canónica dos troços (curvas `edgeCurve`) usada pelo mapa e pelos pórticos.
 *
 * Dentro de cada passo do percurso o veículo anda a velocidade constante (a duração do passo é o
 * tempo com congestionamento desse sentido). Entre passos, a posição é contínua: o fim de um troço é
 * o início do seguinte (o mesmo nó). A orientação usa a direção entre dois pontos a ±HEADING_LOOKAHEAD
 * de distância, por isso a viragem num nó é suave, nunca brusca.
 */

/** Meia distância (unidades do mapa) usada para calcular a direção de forma suave. */
export const HEADING_LOOKAHEAD = 1.5
/** Afastamento lateral para a direita do sentido de marcha (os dois sentidos não se sobrepõem). */
export const LANE_OFFSET = 1.1

interface EdgeGeometry {
  readonly points: readonly SchematicPoint[]
  /** Comprimento acumulado até cada ponto. */
  readonly cumulative: readonly number[]
  readonly length: number
}

export interface MotionGeometry {
  readonly edges: ReadonlyMap<EdgeId, EdgeGeometry>
  readonly edgeFrom: ReadonlyMap<EdgeId, string>
}

export function createMotionGeometry(dataset: NetworkDataset): MotionGeometry {
  const edges = new Map<EdgeId, EdgeGeometry>()
  for (const edge of dataset.network.edges) {
    const points = edgeCurve(dataset, edge.id)
    if (!points || points.length < 2) continue
    const cumulative = [0]
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1] as SchematicPoint
      const b = points[index] as SchematicPoint
      cumulative.push((cumulative[index - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y))
    }
    edges.set(edge.id, { points, cumulative, length: cumulative.at(-1) as number })
  }
  return { edges, edgeFrom: new Map(dataset.network.edges.map((edge) => [edge.id, edge.from])) }
}

/** Ponto a uma distância `d` do início da geometria (limitado a [0, comprimento]). */
function pointAtDistance(geometry: EdgeGeometry, d: number): SchematicPoint {
  const target = Math.min(Math.max(d, 0), geometry.length)
  const { cumulative, points } = geometry
  let low = 0
  let high = cumulative.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if ((cumulative[mid] as number) <= target) low = mid
    else high = mid
  }
  const a = points[low] as SchematicPoint
  const b = points[high] as SchematicPoint
  const span = (cumulative[high] as number) - (cumulative[low] as number)
  const t = span > 0 ? (target - (cumulative[low] as number)) / span : 0
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Um percurso preparado para animação: passos com geometria, sentido e duração. */
export interface RouteMotion {
  readonly steps: ReadonlyArray<{
    readonly geometry: EdgeGeometry
    /** `true` se o passo percorre o troço no sentido da sua geometria (from → to). */
    readonly forward: boolean
    readonly durationMin: number
    /** Minuto (desde a partida) em que o passo começa. */
    readonly startMin: number
  }>
  readonly durationMin: number
}

export function prepareRoute(
  geometry: MotionGeometry,
  route: readonly RouteStep[],
  stepDurations: readonly number[],
): RouteMotion | null {
  const steps: Array<RouteMotion['steps'][number]> = []
  let elapsed = 0
  for (let index = 0; index < route.length; index++) {
    const step = route[index] as RouteStep
    const edgeGeometry = geometry.edges.get(step.edgeId)
    const duration = stepDurations[index] ?? 0
    if (!edgeGeometry || !(duration > 0) || !Number.isFinite(duration)) return null
    steps.push({ geometry: edgeGeometry, forward: geometry.edgeFrom.get(step.edgeId) === step.from, durationMin: duration, startMin: elapsed })
    elapsed += duration
  }
  return steps.length > 0 ? { steps, durationMin: elapsed } : null
}

/** Passo e distância (ao longo do troço, no sentido de marcha) num minuto da viagem. */
function locate(motion: RouteMotion, minute: number): { stepIndex: number; along: number } {
  const t = Math.min(Math.max(minute, 0), motion.durationMin)
  let index = motion.steps.length - 1
  for (let i = 0; i < motion.steps.length; i++) {
    const step = motion.steps[i] as RouteMotion['steps'][number]
    if (t < step.startMin + step.durationMin) {
      index = i
      break
    }
  }
  const step = motion.steps[index] as RouteMotion['steps'][number]
  const fraction = Math.min(Math.max((t - step.startMin) / step.durationMin, 0), 1)
  return { stepIndex: index, along: fraction * step.geometry.length }
}

/** Ponto no sentido de marcha: distância `along` a partir da entrada no troço do passo `stepIndex`. */
function pointOnStep(motion: RouteMotion, stepIndex: number, along: number): SchematicPoint {
  // Distâncias fora do passo continuam no passo anterior/seguinte (para a direção suave nos nós).
  let index = stepIndex
  let d = along
  while (d < 0 && index > 0) {
    index--
    d += (motion.steps[index] as RouteMotion['steps'][number]).geometry.length
  }
  while (index < motion.steps.length - 1 && d > (motion.steps[index] as RouteMotion['steps'][number]).geometry.length) {
    d -= (motion.steps[index] as RouteMotion['steps'][number]).geometry.length
    index++
  }
  const step = motion.steps[index] as RouteMotion['steps'][number]
  return pointAtDistance(step.geometry, step.forward ? d : step.geometry.length - d)
}

export interface Pose {
  /** Posição no centro do troço (sem afastamento lateral). */
  readonly center: SchematicPoint
  /** Posição na faixa da direita do sentido de marcha. */
  readonly point: SchematicPoint
  /** Ângulo da direção de marcha no plano do mapa (rad; 0 = +x, a crescer para +y). */
  readonly heading: number
  readonly stepIndex: number
}

/** Pose de um veículo `minute` minutos depois da partida. */
export function poseAt(motion: RouteMotion, minute: number): Pose {
  const { stepIndex, along } = locate(motion, minute)
  const center = pointOnStep(motion, stepIndex, along)
  const behind = pointOnStep(motion, stepIndex, along - HEADING_LOOKAHEAD)
  const ahead = pointOnStep(motion, stepIndex, along + HEADING_LOOKAHEAD)
  let dx = ahead.x - behind.x
  let dy = ahead.y - behind.y
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    dx = 1
    dy = 0
  } else {
    dx /= length
    dy /= length
  }
  // Direita do sentido de marcha num plano com y para baixo: (−dy, dx).
  return {
    center,
    point: { x: center.x - dy * LANE_OFFSET, y: center.y + dx * LANE_OFFSET },
    heading: Math.atan2(dy, dx),
    stepIndex,
  }
}
