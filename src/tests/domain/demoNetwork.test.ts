/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { loadNetwork } from '../../data/loadNetwork.ts'
import { buildAdjacency, reachableFrom } from '../../domain/graph.ts'
import { summarizeNetwork } from '../../domain/summary.ts'
import { validateDataset } from '../../domain/validation.ts'
import { edge, triangleDataset } from '../fixtures.ts'

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

  it('assinala a natureza esquemática e ilustrativa dos dados', () => {
    expect(demoNetwork.layout.kind).toBe('schematic')
    expect(demoNetwork.geography).toBeNull()
    expect(demoNetwork.illustrativeValues).toBe(true)
    expect(demoNetwork.disclaimer).toMatch(/esquemática/i)
    expect(demoNetwork.disclaimer).toMatch(/não é cartográfica/i)
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

describe('loadNetwork', () => {
  it('recusa um conjunto de dados inválido e devolve os problemas', () => {
    const dataset = triangleDataset()
    const broken = { ...dataset, network: { ...dataset.network, edges: [...dataset.network.edges, edge('ax', 'a', 'x')] } }
    const result = loadNetwork(broken)
    expect(result.status).toBe('invalid')
    expect(result.status === 'invalid' && result.issues.map((issue) => issue.code)).toEqual(['unknown-node'])
  })
})
