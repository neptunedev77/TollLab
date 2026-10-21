/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { edgePolyline, polylineLength } from '../../domain/geometry.ts'
import { buildAdjacency, canTraverse, reachableFrom } from '../../domain/graph.ts'
import { checkTariffCents, formatEuros } from '../../domain/money.ts'
import type { RoadNetwork } from '../../domain/types.ts'
import { edge, triangleDataset } from '../fixtures.ts'

const nodes = triangleDataset().network.nodes

describe('buildAdjacency', () => {
  it('cria ligações nos dois sentidos para troços bidirecionais', () => {
    const adjacency = buildAdjacency({ nodes, edges: [edge('ab', 'a', 'b')] })
    expect(adjacency.get('a')).toEqual([{ edgeId: 'ab', to: 'b' }])
    expect(adjacency.get('b')).toEqual([{ edgeId: 'ab', to: 'a' }])
  })

  it('cria só a ligação permitida para troços de sentido único', () => {
    const adjacency = buildAdjacency({ nodes, edges: [edge('ab', 'a', 'b', { oneWay: true })] })
    expect(adjacency.get('a')).toEqual([{ edgeId: 'ab', to: 'b' }])
    expect(adjacency.get('b')).toEqual([])
  })
})

describe('reachableFrom', () => {
  const network: RoadNetwork = {
    nodes,
    edges: [edge('ab', 'a', 'b', { oneWay: true }), edge('bc', 'b', 'c')],
  }
  const adjacency = buildAdjacency(network)

  it('segue os sentidos de circulação', () => {
    expect([...reachableFrom(adjacency, 'a')].sort()).toEqual(['a', 'b', 'c'])
    expect([...reachableFrom(adjacency, 'c')].sort()).toEqual(['b', 'c'])
  })

  it('devolve vazio para um nó inexistente', () => {
    expect(reachableFrom(adjacency, 'x').size).toBe(0)
  })
})

describe('canTraverse', () => {
  it('permite o sentido inverso só em troços bidirecionais', () => {
    expect(canTraverse(edge('ab', 'a', 'b'), 'b', 'a')).toBe(true)
    expect(canTraverse(edge('ab', 'a', 'b', { oneWay: true }), 'b', 'a')).toBe(false)
    expect(canTraverse(edge('ab', 'a', 'b', { oneWay: true }), 'a', 'b')).toBe(true)
    expect(canTraverse(edge('ab', 'a', 'b'), 'a', 'c')).toBe(false)
  })
})

describe('geometria esquemática', () => {
  it('compõe a polilinha a partir das posições dos nós e dos pontos intermédios', () => {
    const dataset = triangleDataset({
      layout: { ...triangleDataset().layout, edgeBends: { ab: [{ x: 50, y: -20 }] } },
    })
    expect(edgePolyline(dataset, 'ab')).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: -20 },
      { x: 100, y: 0 },
    ])
    expect(edgePolyline(dataset, 'nao-existe')).toBeNull()
  })

  it('mede o comprimento de uma polilinha', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11)
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0)
  })
})

describe('tarifas', () => {
  it.each([
    [185, true],
    [0, true],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
    [Number.NEGATIVE_INFINITY, false],
    ['185', false],
    [undefined, false],
  ])('checkTariffCents(%s) → válido: %s', (value, valid) => {
    expect(checkTariffCents(value).ok).toBe(valid)
  })

  it('formata cêntimos em euros no formato português', () => {
    expect(formatEuros(185)).toMatch(/^1,85\s€$/)
    expect(formatEuros(0)).toMatch(/^0,00\s€$/)
  })
})
