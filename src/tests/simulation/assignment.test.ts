/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, demoDemand } from '../../data/demoDemand.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { setTollActive, setTollTariff } from '../../domain/tolls.ts'
import type { DemandSpec, NetworkDataset, TollPoint } from '../../domain/types.ts'
import { assignTraffic } from '../../simulation/assignment.ts'
import { generateVehicles, validateDemand } from '../../simulation/demand.ts'
import { isConnectedRoute } from '../../simulation/routing.ts'
import { edge, toll, triangleDataset } from '../fixtures.ts'

/**
 * Cenário controlado: entre A e B há uma via rápida com portagem (10 min) e uma alternativa grátis
 * (20 min). Um só perfil de condutor (12 €/h = 20 c/min, com ±15% de variação: 17–23 c/min).
 * Assim é possível prever as escolhas: a portagem compensa enquanto valer menos de 10 minutos.
 */
function parallelRoads(tollCents: number, options: { freeCapacity?: number; tollActive?: boolean } = {}) {
  const dataset: NetworkDataset = {
    ...triangleDataset(),
    network: {
      nodes: [
        { id: 'a', name: 'A', kind: 'city' },
        { id: 'b', name: 'B', kind: 'city' },
        { id: 'm', name: 'M', kind: 'interchange' },
      ],
      edges: [
        edge('fast', 'a', 'b', { baseTimeMin: 10, capacityVehPerHour: 100_000 }),
        edge('free-1', 'a', 'm', { baseTimeMin: 10, roadClass: 'alternative', capacityVehPerHour: options.freeCapacity ?? 100_000 }),
        edge('free-2', 'm', 'b', { baseTimeMin: 10, roadClass: 'alternative', capacityVehPerHour: 100_000 }),
      ],
    },
    tolls: [],
  }
  const tolls: TollPoint[] = [
    toll('t', 'fast', { active: options.tollActive ?? true, tariffCents: { c1: tollCents, c2: tollCents, c3: tollCents, c4: tollCents } }),
  ]
  const demand: DemandSpec = {
    odPairs: [{ originId: 'a', destinationId: 'b', tripsPerHour: 400 }],
    classShares: { c1: 1, c2: 0, c3: 0, c4: 0 },
    profiles: [{ id: 'p', name: 'Perfil', valueOfTimeEurPerHour: 12, share: 1 }],
  }
  return { dataset, tolls, demand }
}

const shareOnTollRoad = (tollCents: number, options?: Parameters<typeof parallelRoads>[1]) => {
  const { dataset, tolls, demand } = parallelRoads(tollCents, options)
  const result = assignTraffic(dataset, tolls, demand, { seed: 11 })
  return (result.edgeVolumes.get('fast') ?? 0) / result.summary.routed
}

describe('assignTraffic na rede de demonstração', () => {
  const result = assignTraffic(demoNetwork, demoNetwork.tolls, demoDemand, { seed: DEFAULT_SEED })

  it('afeta toda a procura e cada percurso é uma cadeia contínua de troços válidos', () => {
    expect(result.summary.vehicles).toBe(7000)
    expect(result.summary.noRoute).toBe(0)
    for (const vehicle of result.vehicles) {
      expect(isConnectedRoute(demoNetwork.network, vehicle.route ?? [], vehicle.originId, vehicle.destinationId)).toBe(true)
    }
  })

  it('os volumes por troço são exatamente a soma dos veículos que o percorrem', () => {
    const counted = new Map<string, number>()
    for (const vehicle of result.vehicles) {
      for (const step of vehicle.route ?? []) counted.set(step.edgeId, (counted.get(step.edgeId) ?? 0) + 1)
    }
    for (const [edgeId, volume] of result.edgeVolumes) expect(volume).toBe(counted.get(edgeId) ?? 0)
  })

  it('a mesma semente e os mesmos parâmetros dão resultados idênticos', () => {
    const again = assignTraffic(demoNetwork, demoNetwork.tolls, demoDemand, { seed: DEFAULT_SEED })
    expect(again.vehicles).toEqual(result.vehicles)
    expect([...again.edgeVolumes]).toEqual([...result.edgeVolumes])
    expect(again.summary).toEqual(result.summary)
  })

  it('sementes diferentes dão variação controlada (resultados próximos, não idênticos)', () => {
    const other = assignTraffic(demoNetwork, demoNetwork.tolls, demoDemand, { seed: DEFAULT_SEED + 1 })
    expect(other.vehicles).not.toEqual(result.vehicles)
    expect(other.summary.vehicles).toBe(result.summary.vehicles)
    expect(Math.abs((other.summary.averageTimeMin ?? 0) - (result.summary.averageTimeMin ?? 0))).toBeLessThan(2)
  })

  it('aumentar a tarifa de um pórtico desvia tráfego desse troço (sem impor o resultado)', () => {
    const volumeAt = (cents: number) => {
      const edit = setTollTariff(demoNetwork, demoNetwork.tolls, 'toll-a3-maia', 'c1', cents)
      if (!edit.ok) throw new Error(edit.message)
      return assignTraffic(demoNetwork, edit.tolls, demoDemand, { seed: DEFAULT_SEED }).edgeVolumes.get('a3-maia-famalicao') ?? 0
    }
    const volumes = [100, 185, 400, 800].map(volumeAt)
    for (let i = 1; i < volumes.length; i++) expect(volumes[i]).toBeLessThanOrEqual(volumes[i - 1] ?? 0)
    expect(volumes.at(-1)).toBeLessThan((volumes[0] ?? 0) / 2)
  })

  it('desativar um pórtico atrai tráfego para o seu troço', () => {
    const edit = setTollActive(demoNetwork, demoNetwork.tolls, 'toll-a4-penafiel', false)
    if (!edit.ok) throw new Error(edit.message)
    const free = assignTraffic(demoNetwork, edit.tolls, demoDemand, { seed: DEFAULT_SEED })
    expect(free.edgeVolumes.get('a4-porto-penafiel')).toBeGreaterThan(result.edgeVolumes.get('a4-porto-penafiel') ?? 0)
    expect(free.tollAvoiders.has('toll-a4-penafiel')).toBe(false)
  })
})

describe('cenário controlado: escolha pelo custo generalizado', () => {
  it('portagem barata (< 10 min equivalentes para todos): todos usam a via rápida', () => {
    expect(shareOnTollRoad(100)).toBe(1) // 100 c ≤ 5,9 min para qualquer condutor
  })

  it('portagem cara (> 10 min equivalentes para todos): todos usam a alternativa', () => {
    expect(shareOnTollRoad(300)).toBe(0) // 300 c ≥ 13 min para qualquer condutor
  })

  it('tarifa intermédia divide os condutores conforme o seu valor do tempo', () => {
    const share = shareOnTollRoad(200) // 200 c ≈ 8,7–11,8 min: depende do condutor
    expect(share).toBeGreaterThan(0.1)
    expect(share).toBeLessThan(0.9)
  })

  it('a quota na via com portagem nunca aumenta quando a tarifa aumenta', () => {
    const shares = [150, 175, 200, 225, 250].map((cents) => shareOnTollRoad(cents))
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeLessThanOrEqual(shares[i - 1] ?? 1)
  })

  it('um pórtico inativo não tem efeito na escolha', () => {
    expect(shareOnTollRoad(10_000, { tollActive: false })).toBe(1)
  })

  it('com a alternativa congestionada, parte do tráfego volta a pagar portagem', () => {
    // Com 300 c todos fugiriam; mas com capacidade 100 na alternativa, o tempo dela dispara.
    expect(shareOnTollRoad(300, { freeCapacity: 100 })).toBeGreaterThan(0.3)
  })

  it('quem foge à portagem conta como "evitou portagens" e para o pórtico', () => {
    const { dataset, tolls, demand } = parallelRoads(300)
    const result = assignTraffic(dataset, tolls, demand, { seed: 11 })
    expect(result.summary.avoidingTolls).toBe(400)
    expect(result.summary.payingVehicles).toBe(0)
    expect(result.tollAvoiders.get('t')).toBe(400)
  })
})

describe('sem percurso, sem teletransporte', () => {
  it('veículos sem caminho ficam marcados e são contados à parte', () => {
    const { dataset, tolls, demand } = parallelRoads(100)
    const oneWay: NetworkDataset = {
      ...dataset,
      network: {
        ...dataset.network,
        edges: dataset.network.edges.map((e) => ({ ...e, oneWay: true })),
      },
    }
    const backwards: DemandSpec = { ...demand, odPairs: [{ originId: 'b', destinationId: 'a', tripsPerHour: 25 }] }
    const result = assignTraffic(oneWay, tolls, backwards, { seed: 3 })
    expect(result.summary).toMatchObject({ vehicles: 25, routed: 0, noRoute: 25, averageTimeMin: null })
    expect(result.vehicles.every((vehicle) => vehicle.status === 'no-route' && vehicle.route === null)).toBe(true)
    expect([...result.edgeVolumes.values()].every((volume) => volume === 0)).toBe(true)
  })
})

describe('procura', () => {
  it('a procura de demonstração é válida e gera 7000 veículos reprodutíveis', () => {
    expect(validateDemand(demoNetwork.network, demoDemand)).toEqual({ ok: true })
    const vehicles = generateVehicles(demoDemand, 5)
    expect(vehicles).toHaveLength(7000)
    expect(generateVehicles(demoDemand, 5)).toEqual(vehicles)
  })

  it('as quotas de classes e perfis aproximam-se das definidas', () => {
    const vehicles = generateVehicles(demoDemand, 5)
    const share = (predicate: (v: (typeof vehicles)[number]) => boolean) => vehicles.filter(predicate).length / vehicles.length
    expect(share((v) => v.vehicleClass === 'c1')).toBeCloseTo(0.88, 1)
    expect(share((v) => v.profileId === 'poupado')).toBeCloseTo(0.25, 1)
    for (const vehicle of vehicles) {
      const profile = demoDemand.profiles.find((p) => p.id === vehicle.profileId)
      expect(vehicle.valueOfTimeEurPerHour / (profile?.valueOfTimeEurPerHour ?? 1)).toBeGreaterThanOrEqual(0.84)
      expect(vehicle.valueOfTimeEurPerHour / (profile?.valueOfTimeEurPerHour ?? 1)).toBeLessThanOrEqual(1.16)
    }
  })

  it('rejeita procura inválida com mensagens compreensíveis', () => {
    const invalid: DemandSpec = {
      odPairs: [
        { originId: 'porto', destinationId: 'lisboa', tripsPerHour: 10 },
        { originId: 'porto', destinationId: 'porto', tripsPerHour: 10 },
        { originId: 'porto', destinationId: 'braga', tripsPerHour: 2.5 },
      ],
      classShares: { c1: 0.5, c2: 0.2, c3: 0, c4: 0 },
      profiles: [
        { id: 'x', name: 'X', valueOfTimeEurPerHour: 0, share: 0.5 },
        { id: 'x', name: 'Y', valueOfTimeEurPerHour: 10, share: 0.2 },
      ],
    }
    const result = validateDemand(demoNetwork.network, invalid)
    expect(result.ok ? [] : result.issues.map((issue) => issue.code).sort()).toEqual([
      'duplicate-id',
      'invalid-number',
      'invalid-number',
      'invalid-number',
      'invalid-number',
      'self-loop',
      'unknown-node',
    ])
  })
})
