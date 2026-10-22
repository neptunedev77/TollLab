/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, demoDemand } from '../../data/demoDemand.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import type { DemandSpec, NetworkDataset, TollPoint, Vehicle } from '../../domain/types.ts'
import { assignTraffic } from '../../simulation/assignment.ts'
import { createChargeLedger, crossingsOf, passageEventId } from '../../simulation/charging.ts'
import { chargePeriod, DEMO_COST_MODEL, summarizeRevenue } from '../../simulation/economics.ts'
import { edge, toll, triangleDataset } from '../fixtures.ts'

const vehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  originId: 'a',
  destinationId: 'c',
  vehicleClass: 'c1',
  profileId: 'p',
  valueOfTimeEurPerHour: 10,
  route: [
    { edgeId: 'ab', from: 'a', to: 'b' },
    { edgeId: 'bc', from: 'b', to: 'c' },
  ],
  status: 'pending',
  ...overrides,
})

const tariff = { c1: 100, c2: 175, c3: 225, c4: 250 }

describe('livro de cobranças', () => {
  it('cobra uma passagem num pórtico ativo do percurso, com a tarifa da classe do veículo', () => {
    const ledger = createChargeLedger([toll('t1', 'ab', { tariffCents: tariff })])
    const result = ledger.record({ vehicle: vehicle({ vehicleClass: 'c3' }), stepIndex: 0, tollId: 't1' })
    expect(result).toEqual({
      ok: true,
      event: {
        id: passageEventId('v1', 0, 't1'),
        vehicleId: 'v1',
        tollId: 't1',
        edgeId: 'ab',
        vehicleClass: 'c3',
        tariffCents: 225,
        stepIndex: 0,
        atMinute: null,
      },
    })
    expect(ledger.events).toHaveLength(1)
  })

  it('não cobra pórticos inativos', () => {
    const ledger = createChargeLedger([toll('t1', 'ab', { active: false })])
    expect(ledger.record({ vehicle: vehicle(), stepIndex: 0, tollId: 't1' })).toEqual({ ok: false, reason: 'inactive' })
    expect(ledger.events).toHaveLength(0)
  })

  it('não cobra um pórtico que não está no passo indicado do percurso', () => {
    const ledger = createChargeLedger([toll('t1', 'ca')])
    expect(ledger.record({ vehicle: vehicle(), stepIndex: 0, tollId: 't1' })).toEqual({ ok: false, reason: 'off-route' })
    expect(ledger.record({ vehicle: vehicle(), stepIndex: 9, tollId: 't1' })).toEqual({ ok: false, reason: 'off-route' })
    expect(ledger.record({ vehicle: vehicle({ route: null, status: 'no-route' }), stepIndex: 0, tollId: 't1' })).toEqual({
      ok: false,
      reason: 'off-route',
    })
  })

  it('recusa um evento duplicado: a mesma travessia só é cobrada uma vez', () => {
    const ledger = createChargeLedger([toll('t1', 'ab')])
    const crossing = { vehicle: vehicle(), stepIndex: 0, tollId: 't1' }
    expect(ledger.record(crossing).ok).toBe(true)
    expect(ledger.record(crossing)).toEqual({ ok: false, reason: 'duplicate' })
    expect(ledger.events).toHaveLength(1)
  })

  it('recusa pórticos inexistentes', () => {
    const ledger = createChargeLedger([])
    expect(ledger.record({ vehicle: vehicle(), stepIndex: 0, tollId: 'fantasma' })).toEqual({ ok: false, reason: 'unknown-toll' })
  })

  it('dois pórticos no mesmo troço geram duas passagens (cobrança por pórtico)', () => {
    const tolls = [toll('t1', 'ab', { position: 0.2 }), toll('t2', 'ab', { position: 0.8 })]
    const ledger = createChargeLedger(tolls)
    for (const crossing of crossingsOf(vehicle(), tolls, new Map([['ab', 'a']]))) ledger.record(crossing)
    expect(ledger.events.map((event) => event.tollId)).toEqual(['t1', 't2'])
  })
})

describe('crossingsOf', () => {
  const tolls = [toll('near-a', 'ab', { position: 0.2 }), toll('near-b', 'ab', { position: 0.8 }), toll('t3', 'bc', { position: 0.5 })]
  const edgeFrom = new Map([
    ['ab', 'a'],
    ['bc', 'b'],
  ])

  it('ordena as travessias pelo sentido em que o troço é percorrido e calcula o minuto', () => {
    const forward = crossingsOf(vehicle(), tolls, edgeFrom, [10, 20])
    expect(forward.map((c) => [c.tollId, c.atMinute])).toEqual([
      ['near-a', 2],
      ['near-b', 8],
      ['t3', 20],
    ])

    const backward = crossingsOf(vehicle({ route: [{ edgeId: 'ab', from: 'b', to: 'a' }] }), tolls, edgeFrom, [10])
    expect(backward.map((c) => c.tollId)).toEqual(['near-b', 'near-a'])
    expect(backward[0]?.atMinute).toBeCloseTo(2)
    expect(backward[1]?.atMinute).toBeCloseTo(8)
  })
})

describe('receitas e resultado', () => {
  it('a receita bruta é a soma dos eventos; o líquido subtrai custos fixos (também de pórticos inativos) e de cobrança', () => {
    const tolls = [toll('t1', 'ab'), toll('t2', 'bc', { active: false })]
    const events = [
      { id: 'e1', vehicleId: 'v1', tollId: 't1', edgeId: 'ab', vehicleClass: 'c1' as const, tariffCents: 100, stepIndex: 0, atMinute: null },
      { id: 'e2', vehicleId: 'v2', tollId: 't1', edgeId: 'ab', vehicleClass: 'c4' as const, tariffCents: 250, stepIndex: 0, atMinute: null },
      { id: 'e3', vehicleId: 'v1', tollId: 't1', edgeId: 'ab', vehicleClass: 'c1' as const, tariffCents: 100, stepIndex: 3, atMinute: null },
    ]
    const report = summarizeRevenue(events, tolls, { fixedCentsPerGantryHour: 1000, collectionCentsPerPassage: 10 })
    expect(report).toMatchObject({
      passages: 3,
      payingVehicles: 2,
      grossCents: 450,
      fixedCostCents: 2000,
      collectionCostCents: 30,
      totalCostCents: 2030,
      netCents: 450 - 2030,
    })
    expect(report.byToll.get('t1')).toEqual({ passages: 3, grossCents: 450, fixedCostCents: 1000, collectionCostCents: 30, netCents: -580 })
    expect(report.byToll.get('t2')).toEqual({ passages: 0, grossCents: 0, fixedCostCents: 1000, collectionCostCents: 0, netCents: -1000 })
    expect(report.byClass.c4).toEqual({ passages: 1, grossCents: 250 })
    // Receita bruta e resultado líquido são grandezas diferentes.
    expect(report.netCents).not.toBe(report.grossCents)
  })

  it('cenário controlado com resultado conhecido: 400 veículos × 1,00 €', () => {
    const dataset: NetworkDataset = {
      ...triangleDataset(),
      network: {
        nodes: [
          { id: 'a', name: 'A', kind: 'city' },
          { id: 'b', name: 'B', kind: 'city' },
        ],
        edges: [edge('ab', 'a', 'b', { capacityVehPerHour: 100_000 })],
      },
      tolls: [],
    }
    const tolls: TollPoint[] = [toll('t', 'ab', { tariffCents: { c1: 100, c2: 100, c3: 100, c4: 100 } })]
    const demand: DemandSpec = {
      odPairs: [{ originId: 'a', destinationId: 'b', tripsPerHour: 400 }],
      classShares: { c1: 1, c2: 0, c3: 0, c4: 0 },
      profiles: [{ id: 'p', name: 'P', valueOfTimeEurPerHour: 10, share: 1 }],
    }
    const { report } = chargePeriod(dataset, tolls, assignTraffic(dataset, tolls, demand, { seed: 1 }))
    expect(report).toMatchObject({
      passages: 400,
      payingVehicles: 400,
      grossCents: 40_000,
      fixedCostCents: DEMO_COST_MODEL.fixedCentsPerGantryHour,
      collectionCostCents: 400 * DEMO_COST_MODEL.collectionCentsPerPassage,
      netCents: 40_000 - 2500 - 3200,
    })
  })
})

describe('cobrança do período na rede de demonstração', () => {
  const assignment = assignTraffic(demoNetwork, demoNetwork.tolls, demoDemand, { seed: DEFAULT_SEED })
  const { events, report } = chargePeriod(demoNetwork, demoNetwork.tolls, assignment)
  const tollsById = new Map(demoNetwork.tolls.map((t) => [t.id, t]))

  it('cada passagem elegível é cobrada exatamente uma vez', () => {
    let eligible = 0
    for (const v of assignment.vehicles) {
      for (const step of v.route ?? []) {
        eligible += demoNetwork.tolls.filter((t) => t.active && t.edgeId === step.edgeId).length
      }
    }
    expect(events).toHaveLength(eligible)
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
    expect(report.rejected.duplicate).toBe(0)
    expect(report.rejected['off-route']).toBe(0)
  })

  it('cada evento corresponde a um pórtico ativo no percurso do veículo, com a tarifa da sua classe', () => {
    const vehicles = new Map(assignment.vehicles.map((v) => [v.id, v]))
    for (const event of events) {
      const owner = vehicles.get(event.vehicleId)
      const tollPoint = tollsById.get(event.tollId)
      expect(tollPoint?.active).toBe(true)
      expect(owner?.route?.[event.stepIndex]?.edgeId).toBe(tollPoint?.edgeId)
      expect(event.tariffCents).toBe(tollPoint?.tariffCents[event.vehicleClass])
    }
  })

  it('os totais resultam dos eventos e batem com as portagens de cada viagem', () => {
    expect(report.grossCents).toBe(events.reduce((sum, event) => sum + event.tariffCents, 0))
    expect([...report.byToll.values()].reduce((sum, t) => sum + t.grossCents, 0)).toBe(report.grossCents)
    expect(Object.values(report.byClass).reduce((sum, c) => sum + c.grossCents, 0)).toBe(report.grossCents)

    const perVehicle = new Map<string, number>()
    for (const event of events) perVehicle.set(event.vehicleId, (perVehicle.get(event.vehicleId) ?? 0) + event.tariffCents)
    for (const [vehicleId, trip] of assignment.trips) expect(perVehicle.get(vehicleId) ?? 0).toBe(trip.tollCents)
    expect(report.payingVehicles).toBe(assignment.summary.payingVehicles)
  })

  it('o pórtico inativo não cobra: as suas travessias são recusadas como gratuitas', () => {
    expect(report.byToll.get('toll-a4-vila-real')?.passages).toBe(0)
    expect(report.rejected.inactive).toBe(assignment.edgeVolumes.get('a4-amarante-vila-real'))
  })

  it('os eventos têm o minuto da travessia dentro da duração da viagem', () => {
    for (const event of events.slice(0, 200)) {
      expect(event.atMinute).not.toBeNull()
      expect(event.atMinute ?? -1).toBeGreaterThanOrEqual(0)
      expect(event.atMinute ?? 0).toBeLessThanOrEqual(assignment.trips.get(event.vehicleId)?.timeMin ?? 0)
    }
  })
})
