/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { buildRibbon } from '../../components/scene3d/ribbon.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { edgeCurve, edgePolyline, pointAlong, smoothPolyline } from '../../domain/geometry.ts'

describe('smoothPolyline', () => {
  it('devolve linhas retas sem alterações', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(smoothPolyline(line)).toEqual(line)
  })

  it('passa por todos os pontos de controlo, começando e acabando nos nós', () => {
    const control = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ]
    const curve = smoothPolyline(control, 8)
    expect(curve[0]).toEqual(control[0])
    expect(curve[8]?.x).toBeCloseTo(50)
    expect(curve[8]?.y).toBeCloseTo(40)
    expect(curve.at(-1)?.x).toBeCloseTo(100)
    expect(curve.at(-1)?.y).toBeCloseTo(0)
    expect(curve).toHaveLength(17)
  })

  it('a curva de cada troço da rede começa e acaba nas posições dos seus nós', () => {
    for (const edge of demoNetwork.network.edges) {
      const curve = edgeCurve(demoNetwork, edge.id)
      const control = edgePolyline(demoNetwork, edge.id)
      expect(curve?.[0]).toEqual(control?.[0])
      expect(curve?.at(-1)?.x).toBeCloseTo(control?.at(-1)?.x ?? Number.NaN)
      expect(curve?.at(-1)?.y).toBeCloseTo(control?.at(-1)?.y ?? Number.NaN)
    }
  })
})

describe('pointAlong', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]

  it('encontra pontos por fração do comprimento, com a direção do segmento', () => {
    expect(pointAlong(line, 0.25)).toEqual({ point: { x: 5, y: 0 }, tangent: { x: 1, y: 0 } })
    expect(pointAlong(line, 0.75)).toEqual({ point: { x: 10, y: 5 }, tangent: { x: 0, y: 1 } })
  })

  it('limita t a [0, 1] e recusa linhas sem comprimento', () => {
    expect(pointAlong(line, 2)?.point).toEqual({ x: 10, y: 10 })
    expect(pointAlong([{ x: 1, y: 1 }], 0.5)).toBeNull()
    expect(pointAlong([{ x: 1, y: 1 }, { x: 1, y: 1 }], 0.5)).toBeNull()
  })
})

describe('buildRibbon', () => {
  it('gera dois vértices por ponto, à largura e elevação pedidas', () => {
    const { positions, indices } = buildRibbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      4,
      1.5,
    )
    expect(positions).toHaveLength(3 * 2 * 3)
    expect(indices).toHaveLength(2 * 6)
    // Primeiro par de vértices: ±2 na perpendicular (eixo z do chão), à elevação 1,5.
    expect([...positions.slice(0, 6)]).toEqual([0, 1.5, 2, 0, 1.5, -2])
    expect(Math.max(...indices)).toBe(5)
  })

  it('devolve geometria vazia para entradas inválidas', () => {
    expect(buildRibbon([{ x: 0, y: 0 }], 4, 0).positions).toHaveLength(0)
    expect(buildRibbon([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0, 0).indices).toHaveLength(0)
  })
})
