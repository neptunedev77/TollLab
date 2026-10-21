/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { edgeCurve, pointAlong } from '../../domain/geometry.ts'
import { centsToInput, parseEuroInput } from '../../domain/money.ts'
import {
  addToll,
  clampPosition,
  DEFAULT_TARIFF,
  EDGE_END_MARGIN,
  freePositionOnEdge,
  moveToll,
  removeToll,
  setTollActive,
  setTollTariff,
  snapToNetwork,
} from '../../domain/tolls.ts'
import type { TollPoint } from '../../domain/types.ts'
import { validateTolls } from '../../domain/validation.ts'
import { toll, triangleDataset } from '../fixtures.ts'

const dataset = triangleDataset({ tolls: [] })

function expectOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`esperava sucesso: ${JSON.stringify(result)}`)
  return result as Extract<T, { ok: true }>
}

describe('addToll', () => {
  it('cria um pórtico válido, ativo, com tarifa por omissão e ID e nome únicos', () => {
    const first = expectOk(addToll(dataset, [], { edgeId: 'ab' }))
    expect(first.toll).toMatchObject({ edgeId: 'ab', active: true, tariffCents: DEFAULT_TARIFF })
    expect(first.toll.position).toBeCloseTo(0.5)

    const second = expectOk(addToll(dataset, first.tolls, { edgeId: 'ab' }))
    expect(second.toll.id).not.toBe(first.toll.id)
    expect(second.toll.name).not.toBe(first.toll.name)
    expect(validateTolls(dataset.network, second.tolls)).toEqual({ ok: true })
  })

  it('sem posição, usa o maior espaço livre do troço', () => {
    const tolls = [toll('t1', 'ab', { position: 0.2 })]
    const result = expectOk(addToll(dataset, tolls, { edgeId: 'ab' }))
    expect(result.toll.position).toBeGreaterThan(0.5)
  })

  it('limita a posição às margens das extremidades do troço', () => {
    expect(expectOk(addToll(dataset, [], { edgeId: 'ab', position: 0 })).toll.position).toBe(EDGE_END_MARGIN)
    expect(expectOk(addToll(dataset, [], { edgeId: 'ab', position: 1.4 })).toll.position).toBe(1 - EDGE_END_MARGIN)
  })

  it('recusa troços inexistentes e posições ocupadas', () => {
    expect(addToll(dataset, [], { edgeId: 'nao-existe' })).toMatchObject({ ok: false })
    const tolls = [toll('t1', 'ab', { position: 0.5 })]
    expect(addToll(dataset, tolls, { edgeId: 'ab', position: 0.505 })).toEqual({
      ok: false,
      message: 'Já existe um pórtico muito perto deste ponto do troço.',
    })
  })

  it('recusa quando o troço já não tem espaço livre', () => {
    let tolls: readonly TollPoint[] = []
    let failure = ''
    for (let attempt = 0; attempt < 100 && failure === ''; attempt++) {
      const result = addToll(dataset, tolls, { edgeId: 'ab' })
      if (result.ok) tolls = result.tolls
      else failure = result.message
    }
    expect(failure).toMatch(/não tem espaço livre/)
    expect(tolls.length).toBeGreaterThan(10)
    expect(validateTolls(dataset.network, tolls)).toEqual({ ok: true })
    expect(freePositionOnEdge(tolls, 'ab')).toBeNull()
  })

  it('não altera a lista original', () => {
    const tolls: readonly TollPoint[] = Object.freeze([toll('t1', 'ab')])
    expectOk(addToll(dataset, tolls, { edgeId: 'bc' }))
    expect(tolls).toHaveLength(1)
  })
})

describe('moveToll', () => {
  const tolls = [toll('t1', 'ab', { position: 0.3 }), toll('t2', 'ab', { position: 0.7 })]

  it('desliza ao longo do mesmo troço e muda de troço mantendo a âncora válida', () => {
    expect(expectOk(moveToll(dataset, tolls, 't1', 'ab', 0.4)).toll).toMatchObject({ edgeId: 'ab', position: 0.4 })
    expect(expectOk(moveToll(dataset, tolls, 't1', 'bc', 0.5)).toll).toMatchObject({ edgeId: 'bc', position: 0.5 })
  })

  it('recusa ficar em cima de outro pórtico, em troços inexistentes ou com posição inválida', () => {
    expect(moveToll(dataset, tolls, 't1', 'ab', 0.69)).toMatchObject({ ok: false })
    expect(moveToll(dataset, tolls, 't1', 'nao-existe', 0.5)).toMatchObject({ ok: false })
    expect(moveToll(dataset, tolls, 't1', 'ab', Number.NaN)).toMatchObject({ ok: false })
    expect(moveToll(dataset, tolls, 'fantasma', 'ab', 0.5)).toEqual({ ok: false, message: 'O pórtico já não existe.' })
  })

  it('limita a posição às margens', () => {
    expect(expectOk(moveToll(dataset, tolls, 't1', 'ab', -3)).toll.position).toBe(clampPosition(-3))
  })
})

describe('ativar, tarifas e remover', () => {
  const tolls = [toll('t1', 'ab')]

  it('ativa e desativa a cobrança', () => {
    expect(expectOk(setTollActive(dataset, tolls, 't1', false)).toll.active).toBe(false)
  })

  it('altera a tarifa de uma classe sem mexer nas outras', () => {
    const result = expectOk(setTollTariff(dataset, tolls, 't1', 'c2', 999))
    expect(result.toll.tariffCents).toEqual({ ...tolls[0]?.tariffCents, c2: 999 })
  })

  it.each([-1, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 10_001])('rejeita a tarifa %s', (cents) => {
    expect(setTollTariff(dataset, tolls, 't1', 'c1', cents)).toMatchObject({ ok: false })
  })

  it('remove só o pórtico indicado', () => {
    const many = [toll('t1', 'ab'), toll('t2', 'bc')]
    expect(removeToll(many, 't1').map((t) => t.id)).toEqual(['t2'])
    expect(removeToll(many, 'fantasma')).toHaveLength(2)
  })
})

describe('snapToNetwork', () => {
  it('encaixa um ponto junto a uma estrada no troço certo, na fração certa', () => {
    // Triângulo: ab vai de (0,0) a (100,0).
    const snap = snapToNetwork(dataset, { x: 30, y: 4 }, 10)
    expect(snap).toMatchObject({ edgeId: 'ab' })
    expect(snap?.position).toBeCloseTo(0.3)
    expect(snap?.distance).toBeCloseTo(4)
  })

  it('ignora pontos longe de qualquer estrada e troços excluídos', () => {
    expect(snapToNetwork(dataset, { x: 50, y: -60 }, 10)).toBeNull()
    expect(snapToNetwork(dataset, { x: 30, y: 4 }, 10, (edge) => edge.id !== 'ab')).toBeNull()
  })

  it('segue a geometria curva dos troços da rede real', () => {
    const curve = edgeCurve(demoNetwork, 'n15-vila-real-braganca')
    const target = curve && pointAlong(curve, 0.37)
    if (!target) throw new Error('sem curva')
    const snap = snapToNetwork(demoNetwork, target.point, 2, (edge) => edge.id === 'n15-vila-real-braganca')
    expect(snap?.position).toBeCloseTo(0.37, 2)
  })
})

describe('invariante: nenhuma sequência de edições deixa pórticos inválidos', () => {
  it('mil operações aleatórias (semente fixa) mantêm a lista sempre válida', () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 2 ** 32
      return seed / 2 ** 32
    }
    const edgeIds = demoNetwork.network.edges.map((edge) => edge.id)
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T
    let tolls: readonly TollPoint[] = demoNetwork.tolls

    for (let step = 0; step < 1000; step++) {
      const operation = random()
      const target = tolls.length > 0 ? pick(tolls) : undefined
      let result: { ok: boolean; tolls?: readonly TollPoint[] }
      if (operation < 0.3 || !target) result = addToll(demoNetwork, tolls, { edgeId: pick(edgeIds), position: random() * 1.2 - 0.1 })
      else if (operation < 0.6) result = moveToll(demoNetwork, tolls, target.id, pick(edgeIds), random() * 1.2 - 0.1)
      else if (operation < 0.75) result = setTollTariff(demoNetwork, tolls, target.id, 'c1', Math.round(random() * 12_000) - 1000)
      else if (operation < 0.85) result = setTollActive(demoNetwork, tolls, target.id, random() > 0.5)
      else result = { ok: true, tolls: removeToll(tolls, target.id) }

      if (result.ok && result.tolls) tolls = result.tolls
      expect(validateTolls(demoNetwork.network, tolls)).toEqual({ ok: true })
    }
  })
})

describe('parseEuroInput', () => {
  it.each([
    ['1,85', 185],
    ['1.85', 185],
    ['2', 200],
    [' 0,5 € ', 50],
    ['0', 0],
    ['-0', 0],
    ['100', 10_000],
  ])('aceita "%s" → %i cêntimos', (text, cents) => {
    expect(parseEuroInput(text)).toEqual({ ok: true, cents })
  })

  it.each([
    ['', /Indica uma tarifa/],
    ['abc', /apenas números/],
    ['1,2,3', /apenas números/],
    ['1,855', /duas casas decimais/],
    ['-1', /negativa/],
    ['100,01', /exceder/],
  ])('rejeita "%s"', (text, message) => {
    const result = parseEuroInput(text)
    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).toMatch(message)
  })

  it('converte cêntimos para o texto do campo', () => {
    expect(centsToInput(185)).toBe('1,85')
    expect(centsToInput(5)).toBe('0,05')
  })
})
