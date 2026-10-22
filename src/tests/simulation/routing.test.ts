/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import type { RoadNetwork, RouteStep } from '../../domain/types.ts'
import { BPR_ALPHA, congestedTime, generalizedCost, tollTableByEdge } from '../../simulation/costs.ts'
import { createRandom } from '../../simulation/random.ts'
import { createRouter, isConnectedRoute } from '../../simulation/routing.ts'
import { edge, toll } from '../fixtures.ts'

const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), kind: 'city' as const }))

/** a–b–d (rápido) e a–c–d (lento), mais um troço direto a–d muito lento. */
const network: RoadNetwork = {
  nodes,
  edges: [
    edge('ab', 'a', 'b', { baseTimeMin: 5 }),
    edge('bd', 'b', 'd', { baseTimeMin: 5 }),
    edge('ac', 'a', 'c', { baseTimeMin: 8 }),
    edge('cd', 'c', 'd', { baseTimeMin: 8 }),
    edge('ad', 'a', 'd', { baseTimeMin: 30 }),
  ],
}
const baseTime = (step: RouteStep) => network.edges.find((e) => e.id === step.edgeId)?.baseTimeMin ?? Number.POSITIVE_INFINITY

describe('createRouter', () => {
  const router = createRouter(network)

  it('encontra o caminho mais curto, com passos ligados e no sentido certo', () => {
    const path = router.shortestPath('a', 'd', baseTime)
    expect(path?.cost).toBe(10)
    expect(path?.steps).toEqual([
      { edgeId: 'ab', from: 'a', to: 'b' },
      { edgeId: 'bd', from: 'b', to: 'd' },
    ])
    expect(isConnectedRoute(network, path?.steps ?? [], 'a', 'd')).toBe(true)
  })

  it('percorre troços de dois sentidos ao contrário', () => {
    const path = router.shortestPath('d', 'a', baseTime)
    expect(path?.steps.map((step) => `${step.from}>${step.to}`)).toEqual(['d>b', 'b>a'])
  })

  it('custos infinitos tornam um troço intransitável e o caminho muda para a alternativa', () => {
    const path = router.shortestPath('a', 'd', (step) => (step.edgeId === 'ab' ? Number.POSITIVE_INFINITY : baseTime(step)))
    expect(path?.steps.map((step) => step.edgeId)).toEqual(['ac', 'cd'])
  })

  it('origem igual ao destino dá um percurso vazio; nós inexistentes não têm percurso', () => {
    expect(router.shortestPath('a', 'a', baseTime)).toEqual({ steps: [], cost: 0 })
    expect(router.shortestPath('a', 'x', baseTime)).toBeNull()
  })

  it('desempata de forma determinística', () => {
    const tie = createRouter({ nodes, edges: [edge('ab', 'a', 'b'), edge('bd', 'b', 'd'), edge('ac', 'a', 'c'), edge('cd', 'c', 'd')] })
    const runs = Array.from({ length: 5 }, () => tie.shortestPath('a', 'd', () => 1)?.steps.map((s) => s.edgeId))
    expect(new Set(runs.map((run) => run?.join()))).toEqual(new Set(['ab,bd']))
  })
})

describe('sentidos proibidos e redes sem caminho', () => {
  const oneWay: RoadNetwork = {
    nodes: nodes.slice(0, 3),
    edges: [edge('ab', 'a', 'b', { oneWay: true }), edge('bc', 'b', 'c', { oneWay: true })],
  }
  const router = createRouter(oneWay)

  it('segue sentidos únicos no sentido permitido', () => {
    expect(router.shortestPath('a', 'c', () => 1)?.steps.map((s) => s.edgeId)).toEqual(['ab', 'bc'])
  })

  it('não percorre um sentido único ao contrário: sem caminho', () => {
    expect(router.shortestPath('c', 'a', () => 1)).toBeNull()
  })

  it('não há caminho entre componentes desligadas', () => {
    const split = createRouter({ nodes, edges: [edge('ab', 'a', 'b'), edge('cd', 'c', 'd')] })
    expect(split.shortestPath('a', 'd', () => 1)).toBeNull()
  })

  it('isConnectedRoute deteta saltos, troços inexistentes e sentidos proibidos', () => {
    expect(isConnectedRoute(oneWay, [{ edgeId: 'bc', from: 'b', to: 'c' }], 'a', 'c')).toBe(false)
    expect(isConnectedRoute(oneWay, [{ edgeId: 'zz', from: 'a', to: 'c' }], 'a', 'c')).toBe(false)
    expect(isConnectedRoute(oneWay, [{ edgeId: 'ab', from: 'b', to: 'a' }], 'b', 'a')).toBe(false)
  })
})

describe('custos', () => {
  it('BPR: tempo base sem tráfego; +15% à capacidade; cresce depressa acima dela', () => {
    expect(congestedTime(10, 0, 1000)).toBe(10)
    expect(congestedTime(10, 1000, 1000)).toBeCloseTo(10 * (1 + BPR_ALPHA))
    expect(congestedTime(10, 2000, 1000)).toBeCloseTo(10 * (1 + BPR_ALPHA * 16))
  })

  it('custo generalizado: a portagem converte-se em minutos pelo valor do tempo', () => {
    // 12 €/h = 20 cêntimos por minuto: 200 cêntimos equivalem a 10 minutos.
    expect(generalizedCost(15, 200, 12)).toBeCloseTo(25)
    expect(generalizedCost(15, 0, 12)).toBe(15)
  })

  it('a tabela de portagens soma pórticos ativos do mesmo troço e ignora os inativos', () => {
    const table = tollTableByEdge([
      toll('t1', 'ab', { position: 0.2 }),
      toll('t2', 'ab', { position: 0.8 }),
      toll('t3', 'bd', { active: false }),
    ])
    expect(table.get('ab')).toEqual({ c1: 200, c2: 350, c3: 450, c4: 500 })
    expect(table.has('bd')).toBe(false)
  })
})

describe('createRandom', () => {
  it('a mesma semente produz a mesma sequência; sementes diferentes, sequências diferentes', () => {
    const sequence = (seed: number) => Array.from({ length: 5 }, createRandom(seed).next)
    expect(sequence(7)).toEqual(sequence(7))
    expect(sequence(7)).not.toEqual(sequence(8))
    expect(sequence(7).every((value) => value >= 0 && value < 1)).toBe(true)
  })

  it('weightedIndex respeita os pesos e shuffle não altera o original', () => {
    const random = createRandom(1)
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) {
      const index = random.weightedIndex([1, 0, 3])
      counts[index] = (counts[index] ?? 0) + 1
    }
    expect(counts[1]).toBe(0)
    expect((counts[2] ?? 0) / ((counts[0] ?? 0) + (counts[2] ?? 0))).toBeCloseTo(0.75, 1)

    const items = [1, 2, 3, 4]
    const shuffled = random.shuffle(items)
    expect(items).toEqual([1, 2, 3, 4])
    expect([...shuffled].sort()).toEqual(items)
  })
})
