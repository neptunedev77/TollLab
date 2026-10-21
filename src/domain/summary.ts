import type { NetworkDataset } from './types.ts'

export interface NetworkSummary {
  readonly cities: number
  readonly interchanges: number
  readonly edges: number
  readonly motorwayEdges: number
  readonly alternativeEdges: number
  readonly tolls: number
  readonly activeTolls: number
}

/** Contagens derivadas diretamente dos dados (não são resultados de simulação). */
export function summarizeNetwork(dataset: NetworkDataset): NetworkSummary {
  const { nodes, edges } = dataset.network
  return {
    cities: nodes.filter((node) => node.kind === 'city').length,
    interchanges: nodes.filter((node) => node.kind === 'interchange').length,
    edges: edges.length,
    motorwayEdges: edges.filter((edge) => edge.roadClass === 'motorway').length,
    alternativeEdges: edges.filter((edge) => edge.roadClass === 'alternative').length,
    tolls: dataset.tolls.length,
    activeTolls: dataset.tolls.filter((toll) => toll.active).length,
  }
}

/** Nome legível de um nó, ou o próprio ID se não existir. */
export function nodeName(dataset: NetworkDataset, id: string): string {
  return dataset.network.nodes.find((node) => node.id === id)?.name ?? id
}
