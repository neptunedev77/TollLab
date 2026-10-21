/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import type { NetworkDataset, RoadNetwork, TollPoint } from '../../domain/types.ts'
import {
  validateDataset,
  validateLayout,
  validateNetwork,
  validateTolls,
  type ValidationCode,
  type ValidationResult,
} from '../../domain/validation.ts'
import { edge, toll, triangleDataset } from '../fixtures.ts'

function codes(result: ValidationResult): ValidationCode[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code)
}

const base = triangleDataset()
const withNetwork = (network: Partial<RoadNetwork>): RoadNetwork => ({ ...base.network, ...network })
const withTolls = (tolls: TollPoint[]) => validateTolls(base.network, tolls)

describe('validateNetwork', () => {
  it('aceita uma rede válida', () => {
    expect(validateNetwork(base.network)).toEqual({ ok: true })
  })

  it('rejeita uma rede sem nós', () => {
    expect(codes(validateNetwork({ nodes: [], edges: [] }))).toEqual(['empty-network'])
  })

  it('deteta IDs de nós duplicados', () => {
    const network = withNetwork({ nodes: [...base.network.nodes, { id: 'a', name: 'Outro A', kind: 'city' }] })
    expect(codes(validateNetwork(network))).toContain('duplicate-id')
  })

  it('deteta IDs de troços duplicados', () => {
    const network = withNetwork({ edges: [...base.network.edges, edge('ab', 'b', 'a')] })
    expect(codes(validateNetwork(network))).toContain('duplicate-id')
  })

  it('deteta troços que referem nós inexistentes', () => {
    const network = withNetwork({ edges: [...base.network.edges, edge('ax', 'a', 'x')] })
    const result = validateNetwork(network)
    expect(codes(result)).toContain('unknown-node')
    expect(result.ok ? '' : result.issues[0]?.path).toBe('edges[3].to')
  })

  it('rejeita troços que começam e acabam no mesmo nó', () => {
    const network = withNetwork({ edges: [...base.network.edges, edge('aa', 'a', 'a')] })
    expect(codes(validateNetwork(network))).toContain('self-loop')
  })

  it.each([
    ['tempo base zero', { baseTimeMin: 0 }],
    ['tempo base negativo', { baseTimeMin: -5 }],
    ['tempo base NaN', { baseTimeMin: Number.NaN }],
    ['capacidade infinita', { capacityVehPerHour: Number.POSITIVE_INFINITY }],
    ['comprimento negativo', { lengthKm: -1 }],
  ])('rejeita valores numéricos inválidos: %s', (_label, overrides) => {
    const network = withNetwork({ edges: [edge('ab', 'a', 'b', overrides), edge('bc', 'b', 'c'), edge('ca', 'c', 'a')] })
    expect(codes(validateNetwork(network))).toContain('invalid-number')
  })

  it('aceita comprimento desconhecido (null) e comprimento positivo', () => {
    const network = withNetwork({ edges: [edge('ab', 'a', 'b', { lengthKm: 12.5 }), edge('bc', 'b', 'c'), edge('ca', 'c', 'a')] })
    expect(validateNetwork(network)).toEqual({ ok: true })
  })

  it('deteta nós isolados', () => {
    const network = withNetwork({ nodes: [...base.network.nodes, { id: 'd', name: 'D', kind: 'city' }] })
    expect(codes(validateNetwork(network))).toEqual(['disconnected'])
  })

  it('respeita os sentidos: um troço de sentido único pode deixar nós sem saída', () => {
    const network: RoadNetwork = {
      nodes: base.network.nodes,
      edges: [edge('ab', 'a', 'b', { oneWay: true }), edge('bc', 'b', 'c', { oneWay: true })],
    }
    const result = validateNetwork(network)
    expect(codes(result)).toEqual(['disconnected'])
  })

  it('aceita um circuito de sentido único que liga todos os nós', () => {
    const network: RoadNetwork = {
      nodes: base.network.nodes,
      edges: [
        edge('ab', 'a', 'b', { oneWay: true }),
        edge('bc', 'b', 'c', { oneWay: true }),
        edge('ca', 'c', 'a', { oneWay: true }),
      ],
    }
    expect(validateNetwork(network)).toEqual({ ok: true })
  })
})

describe('validateLayout', () => {
  const withLayout = (layout: Partial<NetworkDataset['layout']>) =>
    validateLayout({ ...base, layout: { ...base.layout, ...layout } })

  it('aceita o esquema válido', () => {
    expect(validateLayout(base)).toEqual({ ok: true })
  })

  it('deteta nós sem posição', () => {
    expect(codes(withLayout({ nodePositions: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } } }))).toContain('missing-position')
  })

  it('deteta posições não finitas', () => {
    const nodePositions = { ...base.layout.nodePositions, a: { x: Number.NaN, y: 0 } }
    expect(codes(withLayout({ nodePositions }))).toContain('invalid-position')
  })

  it('deteta geometria de troços inexistentes', () => {
    expect(codes(withLayout({ edgeBends: { fantasma: [{ x: 1, y: 1 }] } }))).toContain('unknown-edge')
  })

  it('deteta troços sem comprimento no esquema', () => {
    const nodePositions = { ...base.layout.nodePositions, b: { x: 0, y: 0 } }
    expect(codes(withLayout({ nodePositions }))).toContain('degenerate-geometry')
  })
})

describe('validateTolls', () => {
  it('aceita portagens válidas', () => {
    expect(withTolls([toll('t1', 'ab'), toll('t2', 'bc', { position: 0.1 })])).toEqual({ ok: true })
  })

  it('rejeita portagens associadas a troços inexistentes', () => {
    expect(codes(withTolls([toll('t1', 'nao-existe')]))).toEqual(['unknown-edge'])
  })

  it('rejeita IDs de portagem duplicados', () => {
    expect(codes(withTolls([toll('t1', 'ab'), toll('t1', 'bc')]))).toContain('duplicate-id')
  })

  it.each([0, 1, -0.2, 1.5, Number.NaN])('rejeita a posição %s (tem de estar em ]0, 1[)', (position) => {
    expect(codes(withTolls([toll('t1', 'ab', { position })]))).toContain('invalid-toll-position')
  })

  it('rejeita dois pórticos praticamente no mesmo ponto do mesmo troço', () => {
    const result = withTolls([toll('t1', 'ab', { position: 0.5 }), toll('t2', 'ab', { position: 0.51 })])
    expect(codes(result)).toEqual(['duplicate-toll-position'])
  })

  it('aceita dois pórticos bem separados no mesmo troço', () => {
    expect(withTolls([toll('t1', 'ab', { position: 0.3 }), toll('t2', 'ab', { position: 0.7 })])).toEqual({ ok: true })
  })

  it.each([
    ['negativa', -10],
    ['NaN', Number.NaN],
    ['infinita', Number.POSITIVE_INFINITY],
    ['não inteira', 12.5],
    ['acima do limite', 1_000_000],
  ])('rejeita uma tarifa %s', (_label, value) => {
    const result = withTolls([toll('t1', 'ab', { tariffCents: { c1: 100, c2: value, c3: 225, c4: 250 } })])
    expect(codes(result)).toEqual(['invalid-tariff'])
    expect(result.ok ? '' : result.issues[0]?.path).toBe('tolls[0].tariffCents.c2')
  })

  it('aceita tarifa zero (portagem gratuita)', () => {
    expect(withTolls([toll('t1', 'ab', { tariffCents: { c1: 0, c2: 0, c3: 0, c4: 0 } })])).toEqual({ ok: true })
  })

  it('rejeita tarifas em falta para uma classe', () => {
    const tariffCents = { c1: 100, c2: 175, c3: 225 } as unknown as TollPoint['tariffCents']
    expect(codes(withTolls([toll('t1', 'ab', { tariffCents })]))).toEqual(['invalid-tariff'])
  })
})

describe('validateDataset', () => {
  it('junta os problemas de todas as camadas', () => {
    const dataset = triangleDataset({ tolls: [toll('t1', 'ab', { tariffCents: { c1: -1, c2: 0, c3: 0, c4: 0 } })] })
    const broken: NetworkDataset = {
      ...dataset,
      network: { ...dataset.network, edges: [...dataset.network.edges, edge('ax', 'a', 'x')] },
    }
    expect(codes(validateDataset(broken)).sort()).toEqual(['invalid-tariff', 'unknown-node'])
  })
})
