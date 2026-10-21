import { isFinitePoint, edgePolyline, polylineLength } from './geometry.ts'
import { buildAdjacency, reachableFrom } from './graph.ts'
import { checkTariffCents } from './money.ts'
import { VEHICLE_CLASSES, type NetworkDataset, type RoadNetwork, type TollPoint } from './types.ts'

export type ValidationCode =
  | 'empty-network'
  | 'duplicate-id'
  | 'empty-name'
  | 'unknown-node'
  | 'self-loop'
  | 'invalid-number'
  | 'disconnected'
  | 'missing-position'
  | 'invalid-position'
  | 'unknown-edge'
  | 'degenerate-geometry'
  | 'invalid-toll-position'
  | 'duplicate-toll-position'
  | 'invalid-tariff'

export interface ValidationIssue {
  readonly code: ValidationCode
  /** Localização do problema nos dados (ex.: "edges[3].to"). */
  readonly path: string
  readonly message: string
}

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/** Dois pórticos no mesmo troço mais próximos do que isto (fração do troço) contam como duplicados. */
export const MIN_TOLL_SPACING = 0.02

function result(issues: ValidationIssue[]): ValidationResult {
  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/**
 * Invariantes da topologia:
 *  - existe pelo menos um nó; IDs de nós e troços são únicos e não vazios; nomes não são vazios;
 *  - cada troço liga dois nós existentes e diferentes;
 *  - tempos e capacidades são finitos e positivos; o comprimento é `null` ou finito e positivo;
 *  - a rede é fortemente conexa: respeitando os sentidos, cada nó alcança todos os outros.
 */
export function validateNetwork(network: RoadNetwork): ValidationResult {
  const issues: ValidationIssue[] = []

  if (network.nodes.length === 0) {
    return result([{ code: 'empty-network', path: 'nodes', message: 'A rede não tem nós.' }])
  }

  for (const id of findDuplicates(network.nodes.map((node) => node.id))) {
    issues.push({ code: 'duplicate-id', path: 'nodes', message: `O ID de nó "${id}" está repetido.` })
  }
  for (const id of findDuplicates(network.edges.map((edge) => edge.id))) {
    issues.push({ code: 'duplicate-id', path: 'edges', message: `O ID de troço "${id}" está repetido.` })
  }

  network.nodes.forEach((node, index) => {
    if (node.id.trim() === '') {
      issues.push({ code: 'empty-name', path: `nodes[${index}].id`, message: 'Há um nó sem ID.' })
    }
    if (node.name.trim() === '') {
      issues.push({ code: 'empty-name', path: `nodes[${index}].name`, message: `O nó "${node.id}" não tem nome.` })
    }
  })

  const nodeIds = new Set(network.nodes.map((node) => node.id))

  network.edges.forEach((edge, index) => {
    const path = `edges[${index}]`
    if (edge.id.trim() === '') {
      issues.push({ code: 'empty-name', path: `${path}.id`, message: 'Há um troço sem ID.' })
    }
    if (edge.ref.trim() === '') {
      issues.push({ code: 'empty-name', path: `${path}.ref`, message: `O troço "${edge.id}" não tem designação.` })
    }
    for (const end of ['from', 'to'] as const) {
      if (!nodeIds.has(edge[end])) {
        issues.push({
          code: 'unknown-node',
          path: `${path}.${end}`,
          message: `O troço "${edge.id}" refere o nó inexistente "${edge[end]}".`,
        })
      }
    }
    if (edge.from === edge.to) {
      issues.push({ code: 'self-loop', path, message: `O troço "${edge.id}" começa e acaba no mesmo nó.` })
    }
    if (!isPositiveFinite(edge.baseTimeMin)) {
      issues.push({
        code: 'invalid-number',
        path: `${path}.baseTimeMin`,
        message: `O tempo base do troço "${edge.id}" tem de ser um número positivo.`,
      })
    }
    if (!isPositiveFinite(edge.capacityVehPerHour)) {
      issues.push({
        code: 'invalid-number',
        path: `${path}.capacityVehPerHour`,
        message: `A capacidade do troço "${edge.id}" tem de ser um número positivo.`,
      })
    }
    if (edge.lengthKm !== null && !isPositiveFinite(edge.lengthKm)) {
      issues.push({
        code: 'invalid-number',
        path: `${path}.lengthKm`,
        message: `O comprimento do troço "${edge.id}" tem de ser positivo ou desconhecido (null).`,
      })
    }
  })

  // Só faz sentido testar a conectividade sobre referências válidas.
  if (issues.length === 0) {
    const adjacency = buildAdjacency(network)
    const [first] = network.nodes
    if (first) {
      for (const node of network.nodes) {
        const reached = reachableFrom(adjacency, node.id)
        const missing = network.nodes.filter((other) => !reached.has(other.id))
        if (missing.length > 0) {
          issues.push({
            code: 'disconnected',
            path: 'edges',
            message: `A partir de "${node.name}" não é possível chegar a: ${missing.map((m) => m.name).join(', ')}.`,
          })
          break
        }
      }
    }
  }

  return result(issues)
}

/** Cada nó tem uma posição finita; cada geometria refere um troço existente e tem comprimento. */
export function validateLayout(dataset: NetworkDataset): ValidationResult {
  const issues: ValidationIssue[] = []
  const { layout, network } = dataset

  for (const node of network.nodes) {
    const position = layout.nodePositions[node.id]
    if (position === undefined) {
      issues.push({
        code: 'missing-position',
        path: `layout.nodePositions.${node.id}`,
        message: `O nó "${node.id}" não tem posição no esquema.`,
      })
    } else if (!isFinitePoint(position)) {
      issues.push({
        code: 'invalid-position',
        path: `layout.nodePositions.${node.id}`,
        message: `A posição do nó "${node.id}" não é válida.`,
      })
    }
  }

  const nodeIds = new Set(network.nodes.map((node) => node.id))
  for (const id of Object.keys(layout.nodePositions)) {
    if (!nodeIds.has(id)) {
      issues.push({
        code: 'unknown-node',
        path: `layout.nodePositions.${id}`,
        message: `O esquema tem uma posição para o nó inexistente "${id}".`,
      })
    }
  }

  const edgeIds = new Set(network.edges.map((edge) => edge.id))
  for (const [id, bends] of Object.entries(layout.edgeBends)) {
    if (!edgeIds.has(id)) {
      issues.push({
        code: 'unknown-edge',
        path: `layout.edgeBends.${id}`,
        message: `O esquema tem geometria para o troço inexistente "${id}".`,
      })
    } else if (!bends.every(isFinitePoint)) {
      issues.push({
        code: 'invalid-position',
        path: `layout.edgeBends.${id}`,
        message: `A geometria do troço "${id}" tem pontos inválidos.`,
      })
    }
  }

  if (issues.length === 0) {
    for (const edge of network.edges) {
      // Troços com nós inexistentes já são reportados pela validação da topologia.
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
      const polyline = edgePolyline(dataset, edge.id)
      if (!polyline || polylineLength(polyline) <= 0) {
        issues.push({
          code: 'degenerate-geometry',
          path: `layout.edgeBends.${edge.id}`,
          message: `A geometria do troço "${edge.id}" não tem comprimento.`,
        })
      }
    }
  }

  return result(issues)
}

/**
 * Invariantes dos pórticos:
 *  - IDs únicos e nomes não vazios; cada pórtico está num troço existente;
 *  - posição finita em ]0, 1[ (nunca em cima de um nó, para a associação ao troço ser inequívoca);
 *  - dois pórticos no mesmo troço não podem estar praticamente no mesmo sítio;
 *  - há tarifa para todas as classes, em cêntimos inteiros, não negativos e dentro do limite.
 */
export function validateTolls(network: RoadNetwork, tolls: readonly TollPoint[]): ValidationResult {
  const issues: ValidationIssue[] = []
  const edgeIds = new Set(network.edges.map((edge) => edge.id))

  for (const id of findDuplicates(tolls.map((toll) => toll.id))) {
    issues.push({ code: 'duplicate-id', path: 'tolls', message: `O ID de portagem "${id}" está repetido.` })
  }

  tolls.forEach((toll, index) => {
    const path = `tolls[${index}]`
    if (toll.name.trim() === '') {
      issues.push({ code: 'empty-name', path: `${path}.name`, message: `A portagem "${toll.id}" não tem nome.` })
    }
    if (!edgeIds.has(toll.edgeId)) {
      issues.push({
        code: 'unknown-edge',
        path: `${path}.edgeId`,
        message: `A portagem "${toll.id}" está associada ao troço inexistente "${toll.edgeId}".`,
      })
    }
    if (!Number.isFinite(toll.position) || toll.position <= 0 || toll.position >= 1) {
      issues.push({
        code: 'invalid-toll-position',
        path: `${path}.position`,
        message: `A posição da portagem "${toll.id}" tem de estar estritamente entre 0 e 1.`,
      })
    }
    for (const vehicleClass of VEHICLE_CLASSES) {
      const check = checkTariffCents(toll.tariffCents[vehicleClass])
      if (!check.ok) {
        issues.push({
          code: 'invalid-tariff',
          path: `${path}.tariffCents.${vehicleClass}`,
          message: `Portagem "${toll.id}", ${vehicleClass}: ${check.message}`,
        })
      }
    }
  })

  const byEdge = new Map<string, TollPoint[]>()
  for (const toll of tolls) {
    if (!Number.isFinite(toll.position)) continue
    byEdge.set(toll.edgeId, [...(byEdge.get(toll.edgeId) ?? []), toll])
  }
  for (const [edgeId, onEdge] of byEdge) {
    const sorted = [...onEdge].sort((a, b) => a.position - b.position)
    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (previous && current && current.position - previous.position < MIN_TOLL_SPACING) {
        issues.push({
          code: 'duplicate-toll-position',
          path: 'tolls',
          message: `As portagens "${previous.id}" e "${current.id}" estão praticamente no mesmo ponto do troço "${edgeId}".`,
        })
      }
    }
  }

  return result(issues)
}

/** Valida um conjunto de dados completo: topologia, esquema e pórticos. */
export function validateDataset(dataset: NetworkDataset): ValidationResult {
  const issues: ValidationIssue[] = []
  const collect = (check: ValidationResult) => {
    if (!check.ok) issues.push(...check.issues)
  }
  collect(validateNetwork(dataset.network))
  collect(validateLayout(dataset))
  collect(validateTolls(dataset.network, dataset.tolls))
  return result(issues)
}
