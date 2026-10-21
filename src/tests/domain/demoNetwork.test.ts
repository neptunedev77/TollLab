/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { loadNetwork } from '../../data/loadNetwork.ts'
import { buildAdjacency, reachableFrom } from '../../domain/graph.ts'
import { summarizeNetwork } from '../../domain/summary.ts'
import { validateDataset } from '../../domain/validation.ts'
import { PORTUGAL_MAINLAND, type LonLat } from '../../data/geo/basemap.ts'
import { PLACES } from '../../data/geo/places.ts'
import { project } from '../../data/geo/projection.ts'
import { edge, triangleDataset } from '../fixtures.ts'

/** Ponto dentro de polígono (ray casting), em coordenadas geográficas. */
function insidePolygon([lon, lat]: LonLat, ring: readonly LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as LonLat
    const [xj, yj] = ring[j] as LonLat
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

describe('rede de demonstração', () => {
  it('carrega sem problemas de validação', () => {
    expect(validateDataset(demoNetwork)).toEqual({ ok: true })
    expect(loadNetwork().status).toBe('ready')
  })

  it('tem a dimensão esperada', () => {
    expect(summarizeNetwork(demoNetwork)).toEqual({
      cities: 12,
      interchanges: 1,
      edges: 29,
      motorwayEdges: 15,
      alternativeEdges: 14,
      tolls: 6,
      activeTolls: 5,
    })
  })

  it.each([
    ['A3', 'porto', 'valenca'],
    ['A4', 'porto', 'braganca'],
    ['A7', 'vila-do-conde', 'fafe'],
  ])('a %s liga continuamente %s a %s', (ref, from, to) => {
    const onlyRef = { nodes: demoNetwork.network.nodes, edges: demoNetwork.network.edges.filter((e) => e.ref === ref) }
    expect(reachableFrom(buildAdjacency(onlyRef), from).has(to)).toBe(true)
  })

  it('tem alternativa sem autoestradas entre todas as cidades', () => {
    const alternatives = {
      nodes: demoNetwork.network.nodes.filter((node) => node.kind === 'city'),
      edges: demoNetwork.network.edges.filter((e) => e.roadClass === 'alternative'),
    }
    const adjacency = buildAdjacency(alternatives)
    for (const city of alternatives.nodes) {
      expect(reachableFrom(adjacency, city.id).size).toBe(alternatives.nodes.length)
    }
  })

  it('coloca as portagens apenas em autoestradas', () => {
    const motorways = new Set(demoNetwork.network.edges.filter((e) => e.roadClass === 'motorway').map((e) => e.id))
    for (const tollPoint of demoNetwork.tolls) expect(motorways.has(tollPoint.edgeId)).toBe(true)
  })

  it('assinala a origem dos dados geográficos e a natureza ilustrativa dos valores', () => {
    expect(demoNetwork.layout.kind).toBe('projected')
    expect(demoNetwork.geography?.roadGeometry).toBe('approximate')
    expect(demoNetwork.geography?.sources.map((source) => source.license)).toEqual(['Domínio público', 'CC0 1.0'])
    expect(demoNetwork.illustrativeValues).toBe(true)
    expect(demoNetwork.disclaimer).toMatch(/traçado das estradas é aproximado/i)
    expect(demoNetwork.disclaimer).toMatch(/não é cartografia oficial/i)
    // Sem fonte validada, nenhum comprimento é apresentado como conhecido.
    expect(demoNetwork.network.edges.every((e) => e.lengthKm === null)).toBe(true)
  })

  it('mantém todas as posições dentro do plano do esquema', () => {
    const { width, height } = demoNetwork.layout.bounds
    const points = [
      ...Object.values(demoNetwork.layout.nodePositions),
      ...Object.values(demoNetwork.layout.edgeBends).flat(),
    ]
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(width)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(height)
    }
  })
})

describe('posições geográficas', () => {
  it('cada nó tem coordenadas com fonte no Wikidata e a posição é a sua projeção', () => {
    for (const node of demoNetwork.network.nodes) {
      const place = PLACES[node.id]
      expect(place?.wikidata).toMatch(/^Q\d+$/)
      expect(demoNetwork.layout.nodePositions[node.id]).toEqual(project(place?.coordinates ?? [0, 0]))
    }
  })

  it('todas as cidades ficam dentro do contorno de Portugal continental', () => {
    const outside = demoNetwork.network.nodes.filter((node) => {
      const coordinates = PLACES[node.id]?.coordinates
      return !coordinates || !insidePolygon(coordinates, PORTUGAL_MAINLAND)
    })
    expect(outside.map((node) => node.name)).toEqual([])
  })

  it('preserva a orientação geográfica: Porto a sul de Braga, Bragança a leste de Vila Real', () => {
    const at = (id: string) => demoNetwork.layout.nodePositions[id] ?? { x: Number.NaN, y: Number.NaN }
    expect(at('porto').y).toBeGreaterThan(at('braga').y)
    expect(at('valenca').y).toBeLessThan(at('ponte-de-lima').y)
    expect(at('braganca').x).toBeGreaterThan(at('vila-real').x)
    expect(at('vila-do-conde').x).toBeLessThan(at('famalicao').x)
  })
})

describe('loadNetwork', () => {
  it('recusa um conjunto de dados inválido e devolve os problemas', () => {
    const dataset = triangleDataset()
    const broken = { ...dataset, network: { ...dataset.network, edges: [...dataset.network.edges, edge('ax', 'a', 'x')] } }
    const result = loadNetwork(broken)
    expect(result.status).toBe('invalid')
    expect(result.status === 'invalid' && result.issues.map((issue) => issue.code)).toEqual(['unknown-node'])
  })
})
