import type {
  EdgeId,
  NetworkDataset,
  NodeId,
  RoadClass,
  RoadEdge,
  RoadNode,
  SchematicPoint,
  TariffTable,
  TollPoint,
} from '../domain/types.ts'

/*
 * Rede de demonstração esquemática inspirada no Norte de Portugal.
 *
 * - A conectividade segue de forma simplificada as ligações principais (A3, A4, A7, com A28 e A11)
 *   e vias nacionais alternativas. Não é uma representação cartográfica.
 * - As posições são esquemáticas: preservam a orientação relativa aproximada (norte em cima), não
 *   são coordenadas geográficas e não podem ser usadas para medir distâncias.
 * - Tempos, capacidades e tarifas são valores ilustrativos do modelo, não dados oficiais.
 * - Comprimentos ficam `null` porque não há fonte validada.
 */

const nodes: RoadNode[] = [
  { id: 'valenca', name: 'Valença', kind: 'city' },
  { id: 'ponte-de-lima', name: 'Ponte de Lima', kind: 'city' },
  { id: 'braga', name: 'Braga', kind: 'city' },
  { id: 'guimaraes', name: 'Guimarães', kind: 'city' },
  { id: 'fafe', name: 'Fafe', kind: 'city' },
  { id: 'famalicao', name: 'Vila Nova de Famalicão', kind: 'city' },
  { id: 'vila-do-conde', name: 'Vila do Conde', kind: 'city' },
  { id: 'maia', name: 'Nó da Maia', kind: 'interchange' },
  { id: 'porto', name: 'Porto', kind: 'city' },
  { id: 'penafiel', name: 'Penafiel', kind: 'city' },
  { id: 'amarante', name: 'Amarante', kind: 'city' },
  { id: 'vila-real', name: 'Vila Real', kind: 'city' },
  { id: 'braganca', name: 'Bragança', kind: 'city' },
]

const nodePositions: Record<NodeId, SchematicPoint> = {
  valenca: { x: 250, y: 60 },
  'ponte-de-lima': { x: 285, y: 190 },
  braga: { x: 365, y: 320 },
  guimaraes: { x: 510, y: 370 },
  fafe: { x: 635, y: 340 },
  famalicao: { x: 330, y: 440 },
  'vila-do-conde': { x: 150, y: 470 },
  maia: { x: 235, y: 590 },
  porto: { x: 190, y: 690 },
  penafiel: { x: 415, y: 660 },
  amarante: { x: 545, y: 610 },
  'vila-real': { x: 735, y: 560 },
  braganca: { x: 940, y: 220 },
}

/** Capacidades ilustrativas por sentido (veículos/hora). */
const CAPACITY: Record<RoadClass, number> = { motorway: 4000, alternative: 1200 }

function road(ref: string, roadClass: RoadClass, from: NodeId, to: NodeId, baseTimeMin: number): RoadEdge {
  return {
    id: `${ref.toLowerCase()}-${from}-${to}`,
    from,
    to,
    oneWay: false,
    roadClass,
    ref,
    baseTimeMin,
    capacityVehPerHour: CAPACITY[roadClass],
    lengthKm: null,
  }
}

const motorway = (ref: string, from: NodeId, to: NodeId, minutes: number) => road(ref, 'motorway', from, to, minutes)
const alternative = (ref: string, from: NodeId, to: NodeId, minutes: number) =>
  road(ref, 'alternative', from, to, minutes)

const edges: RoadEdge[] = [
  // A3 Porto – Valença
  motorway('A3', 'porto', 'maia', 10),
  motorway('A3', 'maia', 'famalicao', 15),
  motorway('A3', 'famalicao', 'braga', 15),
  motorway('A3', 'braga', 'ponte-de-lima', 20),
  motorway('A3', 'ponte-de-lima', 'valenca', 20),
  // A7 Vila do Conde – Fafe
  motorway('A7', 'vila-do-conde', 'famalicao', 15),
  motorway('A7', 'famalicao', 'guimaraes', 18),
  motorway('A7', 'guimaraes', 'fafe', 12),
  // A4 Porto – Bragança
  motorway('A4', 'porto', 'penafiel', 25),
  motorway('A4', 'penafiel', 'amarante', 15),
  motorway('A4', 'amarante', 'vila-real', 25),
  motorway('A4', 'vila-real', 'braganca', 60),
  // A28 Porto – Vila do Conde e A11 Braga – Penafiel
  motorway('A28', 'porto', 'vila-do-conde', 20),
  motorway('A11', 'braga', 'guimaraes', 15),
  motorway('A11', 'guimaraes', 'penafiel', 30),

  // Vias alternativas
  alternative('N14', 'porto', 'famalicao', 45),
  alternative('N14', 'famalicao', 'braga', 30),
  alternative('N201', 'braga', 'ponte-de-lima', 40),
  alternative('N201', 'ponte-de-lima', 'valenca', 40),
  alternative('N13', 'porto', 'vila-do-conde', 35),
  alternative('N206', 'vila-do-conde', 'famalicao', 30),
  alternative('N206', 'famalicao', 'guimaraes', 35),
  alternative('N206', 'guimaraes', 'fafe', 22),
  alternative('N101', 'braga', 'guimaraes', 30),
  alternative('N101', 'guimaraes', 'amarante', 50),
  alternative('N15', 'porto', 'penafiel', 50),
  alternative('N15', 'penafiel', 'amarante', 30),
  alternative('N15', 'amarante', 'vila-real', 50),
  alternative('N15', 'vila-real', 'braganca', 110),
]

/**
 * Ponto intermédio afastado perpendicularmente do meio do segmento entre dois nós.
 * Serve só para as vias alternativas não se sobreporem às autoestradas no esquema.
 */
function bend(from: NodeId, to: NodeId, offset: number): SchematicPoint[] {
  const a = nodePositions[from]
  const b = nodePositions[to]
  if (!a || !b) return []
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  return [{ x: (a.x + b.x) / 2 + (-dy / length) * offset, y: (a.y + b.y) / 2 + (dx / length) * offset }]
}

const edgeBends: Record<EdgeId, SchematicPoint[]> = {
  'n14-porto-famalicao': bend('porto', 'famalicao', 45),
  'n14-famalicao-braga': bend('famalicao', 'braga', 30),
  'n201-braga-ponte-de-lima': bend('braga', 'ponte-de-lima', -30),
  'n201-ponte-de-lima-valenca': bend('ponte-de-lima', 'valenca', -25),
  'n13-porto-vila-do-conde': bend('porto', 'vila-do-conde', -35),
  'n206-vila-do-conde-famalicao': bend('vila-do-conde', 'famalicao', 30),
  'n206-famalicao-guimaraes': bend('famalicao', 'guimaraes', 35),
  'n206-guimaraes-fafe': bend('guimaraes', 'fafe', 25),
  'n101-braga-guimaraes': bend('braga', 'guimaraes', -30),
  'n101-guimaraes-amarante': bend('guimaraes', 'amarante', -40),
  'n15-porto-penafiel': bend('porto', 'penafiel', 35),
  'n15-penafiel-amarante': bend('penafiel', 'amarante', 25),
  'n15-amarante-vila-real': bend('amarante', 'vila-real', 30),
  'n15-vila-real-braganca': bend('vila-real', 'braganca', 50),
  // Curvas suaves em algumas autoestradas, só por legibilidade.
  'a4-vila-real-braganca': bend('vila-real', 'braganca', -20),
  'a11-guimaraes-penafiel': bend('guimaraes', 'penafiel', 20),
}

/** Tarifa ilustrativa: as classes 2–4 usam múltiplos fixos da classe 1. */
function tariff(class1Cents: number): TariffTable {
  return {
    c1: class1Cents,
    c2: Math.round(class1Cents * 1.75),
    c3: Math.round(class1Cents * 2.25),
    c4: Math.round(class1Cents * 2.5),
  }
}

const tolls: TollPoint[] = [
  {
    id: 'toll-a3-maia',
    name: 'Pórtico A3 Maia – Famalicão',
    edgeId: 'a3-maia-famalicao',
    position: 0.5,
    active: true,
    tariffCents: tariff(185),
  },
  {
    id: 'toll-a3-braga',
    name: 'Pórtico A3 Famalicão – Braga',
    edgeId: 'a3-famalicao-braga',
    position: 0.45,
    active: true,
    tariffCents: tariff(160),
  },
  {
    id: 'toll-a7-guimaraes',
    name: 'Pórtico A7 Famalicão – Guimarães',
    edgeId: 'a7-famalicao-guimaraes',
    position: 0.5,
    active: true,
    tariffCents: tariff(140),
  },
  {
    id: 'toll-a4-penafiel',
    name: 'Pórtico A4 Porto – Penafiel',
    edgeId: 'a4-porto-penafiel',
    position: 0.5,
    active: true,
    tariffCents: tariff(210),
  },
  {
    id: 'toll-a28-vila-do-conde',
    name: 'Pórtico A28 Porto – Vila do Conde',
    edgeId: 'a28-porto-vila-do-conde',
    position: 0.55,
    active: true,
    tariffCents: tariff(120),
  },
  {
    id: 'toll-a4-vila-real',
    name: 'Pórtico A4 Amarante – Vila Real',
    edgeId: 'a4-amarante-vila-real',
    position: 0.6,
    active: false,
    tariffCents: tariff(255),
  },
]

export const demoNetwork: NetworkDataset = {
  id: 'demo-norte-v1',
  name: 'Norte de Portugal (esquemático)',
  description: 'Rede de demonstração com ligações representativas da A3, A4 e A7 e vias alternativas.',
  disclaimer:
    'Rede esquemática inspirada no Norte de Portugal. Não é cartográfica; tempos, capacidades e tarifas são ilustrativos.',
  illustrativeValues: true,
  network: { nodes, edges },
  layout: { kind: 'schematic', bounds: { width: 1000, height: 760 }, nodePositions, edgeBends },
  tolls,
  geography: null,
}
