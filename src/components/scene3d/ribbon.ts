import type { SchematicPoint } from '../../domain/types.ts'

export interface RibbonGeometryData {
  /** x, y, z por vértice; o esquema (x, y) mapeia para o chão 3D (x, z), com y = elevação. */
  readonly positions: Float32Array
  readonly indices: Uint32Array
}

/**
 * Faixa plana de largura constante ao longo de uma polilinha (estradas, brilho de seleção).
 * Cada ponto gera dois vértices, deslocados pela normal média das direções vizinhas; numa curva
 * densamente amostrada isto dá juntas suaves sem cálculo de esquadrias.
 */
export function buildRibbon(points: readonly SchematicPoint[], width: number, elevation: number): RibbonGeometryData {
  const count = points.length
  if (count < 2 || !(width > 0)) return { positions: new Float32Array(0), indices: new Uint32Array(0) }

  const half = width / 2
  const positions = new Float32Array(count * 2 * 3)
  for (let index = 0; index < count; index++) {
    const previous = points[Math.max(index - 1, 0)] as SchematicPoint
    const next = points[Math.min(index + 1, count - 1)] as SchematicPoint
    const point = points[index] as SchematicPoint
    let tx = next.x - previous.x
    let ty = next.y - previous.y
    const length = Math.hypot(tx, ty) || 1
    tx /= length
    ty /= length
    const nx = -ty
    const ny = tx
    const offset = index * 6
    positions.set([point.x + nx * half, elevation, point.y + ny * half], offset)
    positions.set([point.x - nx * half, elevation, point.y - ny * half], offset + 3)
  }

  const indices = new Uint32Array((count - 1) * 6)
  for (let index = 0; index < count - 1; index++) {
    const a = index * 2
    indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], index * 6)
  }
  return { positions, indices }
}
