import type { DemandSpec, NodeId, OriginDestination } from '../domain/types.ts'

/*
 * Procura de demonstração para uma hora de ponta. Todos os valores são PRESSUPOSTOS ILUSTRATIVOS do
 * modelo (não são contagens de tráfego reais): servem para ver como as escolhas mudam com as tarifas.
 *  - Pares origem–destino entre cidades da rede, iguais nos dois sentidos.
 *  - Perfis de condutor com valores do tempo típicos de modelos de transporte (ordens de grandeza).
 *  - Quotas de classe com predominância de ligeiros.
 */

const flows: ReadonlyArray<readonly [NodeId, NodeId, number]> = [
  ['porto', 'braga', 420],
  ['porto', 'famalicao', 240],
  ['porto', 'guimaraes', 300],
  ['porto', 'vila-do-conde', 220],
  ['porto', 'penafiel', 260],
  ['porto', 'amarante', 180],
  ['porto', 'vila-real', 160],
  ['porto', 'braganca', 50],
  ['porto', 'valenca', 80],
  ['porto', 'ponte-de-lima', 90],
  ['porto', 'fafe', 70],
  ['braga', 'guimaraes', 260],
  ['braga', 'famalicao', 150],
  ['braga', 'ponte-de-lima', 120],
  ['braga', 'valenca', 80],
  ['braga', 'vila-do-conde', 70],
  ['guimaraes', 'famalicao', 140],
  ['guimaraes', 'fafe', 120],
  ['guimaraes', 'amarante', 70],
  ['guimaraes', 'penafiel', 80],
  ['famalicao', 'vila-do-conde', 110],
  ['penafiel', 'amarante', 90],
  ['amarante', 'vila-real', 80],
  ['vila-real', 'braganca', 60],
]

const odPairs: OriginDestination[] = flows.flatMap(([a, b, trips]) => [
  { originId: a, destinationId: b, tripsPerHour: trips },
  { originId: b, destinationId: a, tripsPerHour: trips },
])

export const demoDemand: DemandSpec = {
  odPairs,
  classShares: { c1: 0.88, c2: 0.06, c3: 0.02, c4: 0.04 },
  profiles: [
    { id: 'pressa', name: 'Com pressa', valueOfTimeEurPerHour: 20, share: 0.3 },
    { id: 'equilibrado', name: 'Equilibrado', valueOfTimeEurPerHour: 10, share: 0.45 },
    { id: 'poupado', name: 'Poupado', valueOfTimeEurPerHour: 4, share: 0.25 },
  ],
}

/** Semente por omissão das simulações de demonstração. */
export const DEFAULT_SEED = 2026
