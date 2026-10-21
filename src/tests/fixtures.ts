import type { NetworkDataset, RoadEdge, TollPoint } from '../domain/types.ts'

export function edge(id: string, from: string, to: string, overrides: Partial<RoadEdge> = {}): RoadEdge {
  return {
    id,
    from,
    to,
    oneWay: false,
    roadClass: 'motorway',
    ref: 'A0',
    baseTimeMin: 10,
    capacityVehPerHour: 1000,
    lengthKm: null,
    ...overrides,
  }
}

export function toll(id: string, edgeId: string, overrides: Partial<TollPoint> = {}): TollPoint {
  return {
    id,
    name: `Pórtico ${id}`,
    edgeId,
    position: 0.5,
    active: true,
    tariffCents: { c1: 100, c2: 175, c3: 225, c4: 250 },
    ...overrides,
  }
}

/** Triângulo A–B–C, válido, com uma portagem em A–B. */
export function triangleDataset(overrides: Partial<NetworkDataset> = {}): NetworkDataset {
  return {
    id: 'test',
    name: 'Teste',
    description: 'Rede de teste',
    disclaimer: 'Dados de teste',
    illustrativeValues: true,
    network: {
      nodes: [
        { id: 'a', name: 'A', kind: 'city' },
        { id: 'b', name: 'B', kind: 'city' },
        { id: 'c', name: 'C', kind: 'interchange' },
      ],
      edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ca', 'c', 'a')],
    },
    layout: {
      kind: 'schematic',
      bounds: { width: 100, height: 100 },
      nodePositions: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 50, y: 80 } },
      edgeBends: {},
    },
    tolls: [toll('t1', 'ab')],
    geography: null,
    ...overrides,
  }
}
