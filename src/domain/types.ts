/**
 * Tipos do domínio do TollLab. TypeScript puro: sem React, sem renderização, sem DOM.
 *
 * Três camadas que nunca se misturam:
 *  - Topologia (`RoadNetwork`): nós e troços identificados por ID, sem coordenadas.
 *  - Plano do mapa (`SchematicLayout`): coordenadas de apresentação num plano 2D (esquemático ou
 *    projetado a partir de coordenadas geográficas). Não são coordenadas de ecrã.
 *  - Geografia (`geography`): fontes, licenças e projeção dos dados geográficos usados, ou `null`.
 */

export type NodeId = string
export type EdgeId = string
export type TollId = string
export type VehicleId = string
export type ProfileId = string

// ---------------------------------------------------------------------------
// Topologia

/**
 * - `city`: cidade ou localidade onde o tráfego entra e sai da rede (origem/destino).
 * - `interchange`: nó de ligação entre vias, sem procura própria.
 */
export type NodeKind = 'city' | 'interchange'

export interface RoadNode {
  readonly id: NodeId
  readonly name: string
  /** Nome curto para o rótulo no mapa, quando o nome completo é longo. */
  readonly shortName?: string
  readonly kind: NodeKind
}

/** `motorway`: autoestrada (normalmente com portagem). `alternative`: via alternativa (estrada nacional). */
export type RoadClass = 'motorway' | 'alternative'

export interface RoadEdge {
  readonly id: EdgeId
  readonly from: NodeId
  readonly to: NodeId
  /** `false`: circulável nos dois sentidos. `true`: só de `from` para `to`. */
  readonly oneWay: boolean
  readonly roadClass: RoadClass
  /** Designação da via (ex.: "A3", "N14"). */
  readonly ref: string
  /** Tempo de percurso em fluxo livre, em minutos. */
  readonly baseTimeMin: number
  /** Capacidade por sentido, em veículos por hora. */
  readonly capacityVehPerHour: number
  /** Comprimento em km, ou `null` quando não é conhecido com fonte. */
  readonly lengthKm: number | null
}

export interface RoadNetwork {
  readonly nodes: readonly RoadNode[]
  readonly edges: readonly RoadEdge[]
}

// ---------------------------------------------------------------------------
// Esquema de apresentação

/** Ponto no plano do mapa (y cresce para baixo, norte em cima). */
export interface SchematicPoint {
  readonly x: number
  readonly y: number
}

export interface SchematicLayout {
  /**
   * `schematic`: posições arbitrárias. `projected`: posições dos nós projetadas de coordenadas
   * geográficas reais (o traçado entre nós continua aproximado).
   */
  readonly kind: 'schematic' | 'projected'
  /** Plano de referência, usado para enquadrar o mapa. */
  readonly bounds: { readonly width: number; readonly height: number }
  readonly nodePositions: Readonly<Record<NodeId, SchematicPoint>>
  /**
   * Pontos intermédios de cada troço. Os extremos vêm sempre das posições dos nós, por isso a
   * geometria nunca se pode desligar da topologia. Troços sem entrada são segmentos retos.
   */
  readonly edgeBends: Readonly<Record<EdgeId, readonly SchematicPoint[]>>
}

// ---------------------------------------------------------------------------
// Portagens e tarifas

/** Classes de veículos, seguindo a convenção portuguesa de classes 1 a 4. */
export const VEHICLE_CLASSES = ['c1', 'c2', 'c3', 'c4'] as const
export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

/** Tarifa por classe, em cêntimos de euro (inteiros, para evitar erros de arredondamento). */
export type TariffTable = Readonly<Record<VehicleClass, number>>

/**
 * Ponto de cobrança (pórtico) ancorado a um troço.
 * `position` é a fração do comprimento da geometria do troço, em ]0, 1[, a partir de `from`.
 */
export interface TollPoint {
  readonly id: TollId
  readonly name: string
  readonly edgeId: EdgeId
  readonly position: number
  readonly active: boolean
  readonly tariffCents: TariffTable
}

// ---------------------------------------------------------------------------
// Conjunto de dados de rede

export interface NetworkDataset {
  readonly id: string
  readonly name: string
  readonly description: string
  /** Aviso a mostrar ao utilizador sobre a natureza dos dados. */
  readonly disclaimer: string
  /** `true` quando tempos, capacidades e tarifas são ilustrativos e não reais. */
  readonly illustrativeValues: boolean
  readonly network: RoadNetwork
  readonly layout: SchematicLayout
  readonly tolls: readonly TollPoint[]
  readonly geography: GeographyInfo | null
}

export interface DataSource {
  readonly name: string
  readonly url: string
  readonly license: string
  /** Para que é usada a fonte (ex.: "contorno de Portugal"). */
  readonly usedFor: string
  readonly attributionRequired: boolean
}

export interface GeographyInfo {
  readonly projection: string
  /** Quilómetros por unidade do plano do mapa (aproximado; a projeção é simples). */
  readonly kmPerUnit: number
  /** O traçado dos troços entre nós é aproximado (não segue a estrada real). */
  readonly roadGeometry: 'approximate'
  readonly sources: readonly DataSource[]
}

// ---------------------------------------------------------------------------
// Procura, veículos e cenários (usados pelo motor de simulação)

export interface DriverProfile {
  readonly id: ProfileId
  readonly name: string
  /** Quanto o condutor valoriza o tempo, em euros por hora (pesa o preço face ao tempo). */
  readonly valueOfTimeEurPerHour: number
  /** Proporção dos condutores com este perfil, em [0, 1]. */
  readonly share: number
}

export interface OriginDestination {
  readonly originId: NodeId
  readonly destinationId: NodeId
  readonly tripsPerHour: number
}

export interface DemandSpec {
  readonly odPairs: readonly OriginDestination[]
  /** Proporção de cada classe de veículo, em [0, 1]; a soma deve ser 1. */
  readonly classShares: Readonly<Record<VehicleClass, number>>
  readonly profiles: readonly DriverProfile[]
}

export type VehicleStatus = 'pending' | 'travelling' | 'arrived' | 'no-route'

export interface Vehicle {
  readonly id: VehicleId
  readonly originId: NodeId
  readonly destinationId: NodeId
  readonly vehicleClass: VehicleClass
  readonly profileId: ProfileId
  /** Sequência de troços percorridos, ou `null` quando não existe percurso válido. */
  readonly route: readonly EdgeId[] | null
  readonly status: VehicleStatus
}

/** Resultados agregados de uma execução; o detalhe é definido com o motor de cobrança. */
export interface ScenarioResults {
  readonly computedAt: string
  readonly seed: number
}

export const SCENARIO_SCHEMA_VERSION = 1

export interface Scenario {
  readonly schemaVersion: typeof SCENARIO_SCHEMA_VERSION
  readonly id: string
  readonly name: string
  /** Cópia própria da rede e dos pórticos: alterar um cenário nunca afeta outro. */
  readonly dataset: NetworkDataset
  readonly demand: DemandSpec
  readonly seed: number
  readonly results: ScenarioResults | null
}
