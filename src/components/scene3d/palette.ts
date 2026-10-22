/**
 * Cores da cena 3D. Espelham os tokens de `src/index.css` (o WebGL não lê variáveis CSS);
 * se mudares um token de mapa, muda-o também aqui.
 */
export const SCENE_COLORS = {
  /** Mar: é a cor de fundo do contentor do mapa (token --color-sea); o canvas é transparente. */
  sea: '#dce9ef',
  coastHalo: '#cddfe7',
  portugal: '#f7f0e4',
  spain: '#ebe4d8',
  coastline: '#d6c4a8',
  motorway: '#8a90dc',
  motorwayCasing: '#ffffff',
  alternative: '#c2b098',
  alternativeCasing: '#ffffff',
  hover: '#aab0f0',
  selected: '#5468e8',
  selectedGlow: '#5468e8',
  cityRing: '#2e2a33',
  cityFill: '#ffffff',
  interchangeRing: '#8a8290',
  interchangeFill: '#ffffff',
  tollActive: '#e8935a',
  tollInactive: '#b9afa1',
  /** Camada de tráfego: carga (volume/capacidade) baixa, média e alta. */
  trafficLow: '#5fb595',
  trafficMedium: '#e9b44c',
  trafficHigh: '#d65a4f',
} as const

/** Larguras das estradas, em unidades do mapa (1 unidade = 250 m). */
export const ROAD_WIDTH = {
  motorway: { fill: 3.4, casing: 5.8 },
  alternative: { fill: 2, casing: 3.8 },
  /** Área de clique invisível, mais larga do que a estrada, para facilitar a seleção. */
  hit: 11,
  glow: 12,
} as const

/** Raio dos marcadores de nó, em unidades do mapa. */
export const NODE_RADIUS = { city: 5.5, interchange: 3.6 } as const

export type RoadColoring = 'network' | 'traffic' | 'price' | 'revenue'

export interface ColorBand {
  /** Limite superior (exclusivo) da faixa; a última faixa não tem limite. */
  readonly below: number
  readonly color: string
  readonly label: string
}

/**
 * Escalas das cores das estradas. O mapa e a legenda usam exatamente estas faixas.
 *  - traffic: carga volume/capacidade no sentido mais carregado.
 *  - price: soma das tarifas da classe 1 dos pórticos ativos do troço (cêntimos).
 *  - revenue: receita bruta do troço no período (cêntimos).
 */
export const COLOR_SCALES: Record<Exclude<RoadColoring, 'network'>, readonly ColorBand[]> = {
  traffic: [
    { below: 0.5, color: SCENE_COLORS.trafficLow, label: 'Carga < 50%' },
    { below: 0.85, color: SCENE_COLORS.trafficMedium, label: 'Carga 50–85%' },
    { below: Number.POSITIVE_INFINITY, color: SCENE_COLORS.trafficHigh, label: 'Carga ≥ 85%' },
  ],
  price: [
    { below: 1, color: '#d8d0c4', label: 'Sem portagem' },
    { below: 150, color: '#f3c9a0', label: 'Até 1,50 €' },
    { below: 300, color: '#e8935a', label: '1,50 € – 3 €' },
    { below: Number.POSITIVE_INFINITY, color: '#c85a3c', label: '3 € ou mais' },
  ],
  revenue: [
    { below: 1, color: '#d8d0c4', label: 'Sem receita' },
    { below: 100_000, color: '#f3c9a0', label: 'Até 1 000 €/h' },
    { below: 300_000, color: '#e8935a', label: '1 000 – 3 000 €/h' },
    { below: Number.POSITIVE_INFINITY, color: '#c85a3c', label: '3 000 €/h ou mais' },
  ],
}

export function bandColor(scale: readonly ColorBand[], value: number): string {
  return (scale.find((band) => value < band.below) ?? scale.at(-1))?.color ?? SCENE_COLORS.motorway
}
