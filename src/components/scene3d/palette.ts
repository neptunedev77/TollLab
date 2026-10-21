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
