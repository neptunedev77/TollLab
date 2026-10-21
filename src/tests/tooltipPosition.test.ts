import { describe, expect, it } from 'vitest'
import { positionFor } from '../utils/tooltipPosition.ts'

const viewport = { width: 1280, height: 800 }
const tip = { width: 100, height: 24 }
const rect = (left: number, top: number, width = 32, height = 32) => new DOMRect(left, top, width, height)

describe('positionFor (tooltip)', () => {
  it('centra o balão acima do alvo quando há espaço', () => {
    expect(positionFor(rect(600, 400), tip, 'top', viewport)).toEqual({ left: 566, top: 368 })
  })

  it('não deixa o balão sair pela direita da janela', () => {
    const { left } = positionFor(rect(1240, 8), tip, 'bottom', viewport)
    expect(left + tip.width).toBeLessThanOrEqual(viewport.width - 8)
  })

  it('não deixa o balão sair pelo topo da janela', () => {
    const { top } = positionFor(rect(600, 4), tip, 'top', viewport)
    expect(top).toBeGreaterThanOrEqual(8)
  })
})
