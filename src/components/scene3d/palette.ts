/**
 * Cores da cena 3D. Espelham os tokens de `src/index.css` (o WebGL não lê variáveis CSS);
 * se mudares um token de mapa, muda-o também aqui.
 */
export const SCENE_COLORS = {
  board: '#f4ecdf',
  boardEdge: '#e6d9c4',
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

/** Larguras das estradas, em unidades do esquema. */
export const ROAD_WIDTH = {
  motorway: { fill: 6, casing: 10 },
  alternative: { fill: 3.6, casing: 6.6 },
  /** Área de clique invisível, mais larga do que a estrada, para facilitar a seleção. */
  hit: 18,
  glow: 20,
} as const
