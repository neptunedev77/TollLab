/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { validateTolls } from '../../domain/validation.ts'
import { createMapStore } from '../../store/mapStore.ts'

function setup() {
  let time = 0
  const store = createMapStore(demoNetwork, { animate: false, now: () => time })
  return { store, state: () => store.getState(), tick: (ms: number) => (time += ms) }
}

const tollById = (state: ReturnType<ReturnType<typeof setup>['state']>, id: string) =>
  state.tolls.find((toll) => toll.id === id)

describe('store: edição de pórticos', () => {
  it('o dataset original nunca é alterado', () => {
    const { state } = setup()
    const original = demoNetwork.tolls
    state().setTollTariff('toll-a3-maia', 'c1', 999)
    state().removeToll('toll-a3-braga')
    expect(demoNetwork.tolls).toBe(original)
    expect(demoNetwork.tolls.find((toll) => toll.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)
  })

  it('adicionar seleciona o pórtico novo e mostra uma notificação com Anular', () => {
    const { state } = setup()
    expect(state().addToll('a3-porto-maia')).toBe(true)
    const added = state().tolls.at(-1)
    expect(state().selection).toEqual({ kind: 'toll', id: added?.id })
    expect(state().notice).toMatchObject({ tone: 'info', undoable: true })
  })

  it('uma edição inválida não altera o modelo e mostra um erro', () => {
    const { state } = setup()
    const before = state().tolls
    expect(state().setTollTariff('toll-a3-maia', 'c1', -5)).toBe(false)
    expect(state().moveToll('toll-a3-maia', 'nao-existe', 0.5)).toBe(false)
    expect(state().tolls).toBe(before)
    expect(state().notice?.tone).toBe('error')
  })

  it('anular e refazer percorrem o histórico', () => {
    const { state } = setup()
    state().setTollActive('toll-a3-maia', false)
    state().removeToll('toll-a3-braga')
    expect(state().tolls).toHaveLength(5)

    state().undo()
    expect(state().tolls).toHaveLength(6)
    expect(tollById(state(), 'toll-a3-maia')?.active).toBe(false)
    state().undo()
    expect(tollById(state(), 'toll-a3-maia')?.active).toBe(true)
    expect(state().tolls).toBe(demoNetwork.tolls)

    state().redo()
    state().redo()
    expect(state().tolls).toHaveLength(5)
    // Uma edição nova apaga o "refazer".
    state().undo()
    state().setTollActive('toll-a4-penafiel', false)
    expect(state().future).toHaveLength(0)
  })

  it('alterações seguidas da mesma tarifa juntam-se num só passo do histórico', () => {
    const { state, tick } = setup()
    state().setTollTariff('toll-a3-maia', 'c1', 190)
    tick(200)
    state().setTollTariff('toll-a3-maia', 'c1', 200)
    tick(200)
    state().setTollTariff('toll-a3-maia', 'c1', 210)
    expect(state().past).toHaveLength(1)

    tick(5000)
    state().setTollTariff('toll-a3-maia', 'c1', 220)
    expect(state().past).toHaveLength(2)

    state().undo()
    state().undo()
    expect(tollById(state(), 'toll-a3-maia')?.tariffCents.c1).toBe(185)
  })

  it('arrastar pré-visualiza sem histórico e regista um só passo ao largar', () => {
    const { state } = setup()
    state().beginTollDrag('toll-a3-maia')
    state().dragTollTo('a3-maia-famalicao', 0.3)
    state().dragTollTo('a3-porto-maia', 0.6)
    expect(state().past).toHaveLength(0)
    expect(tollById(state(), 'toll-a3-maia')).toMatchObject({ edgeId: 'a3-porto-maia', position: 0.6 })

    state().endTollDrag(true)
    expect(state().past).toHaveLength(1)
    state().undo()
    expect(tollById(state(), 'toll-a3-maia')).toMatchObject({ edgeId: 'a3-maia-famalicao', position: 0.5 })
  })

  it('cancelar o arrasto (Esc) repõe a posição original sem histórico', () => {
    const { state } = setup()
    state().beginTollDrag('toll-a3-maia')
    state().dragTollTo('a3-porto-maia', 0.6)
    state().endTollDrag(false)
    expect(tollById(state(), 'toll-a3-maia')).toMatchObject({ edgeId: 'a3-maia-famalicao', position: 0.5 })
    expect(state().past).toHaveLength(0)
  })

  it('durante o arrasto, posições em cima de outro pórtico são ignoradas', () => {
    const { state } = setup()
    state().beginTollDrag('toll-a3-maia')
    state().dragTollTo('a3-famalicao-braga', 0.45) // onde está toll-a3-braga
    expect(tollById(state(), 'toll-a3-maia')?.edgeId).toBe('a3-maia-famalicao')
    state().endTollDrag(true)
    expect(validateTolls(demoNetwork.network, state().tolls)).toEqual({ ok: true })
  })

  it('remover o pórtico selecionado limpa a seleção; anular repõe-no', () => {
    const { state } = setup()
    state().select({ kind: 'toll', id: 'toll-a4-penafiel' })
    state().removeToll('toll-a4-penafiel')
    expect(state().selection).toBeNull()
    state().undo()
    expect(tollById(state(), 'toll-a4-penafiel')).toBeDefined()
  })

  it('esconder a camada de pórticos limpa a seleção de um pórtico e impede selecioná-lo', () => {
    const { state } = setup()
    state().select({ kind: 'toll', id: 'toll-a4-penafiel' })
    state().toggleLayer('tolls')
    expect(state().selection).toBeNull()
    state().select({ kind: 'toll', id: 'toll-a4-penafiel' })
    expect(state().selection).toBeNull()
  })

  it('o modo de colocação liga a camada de pórticos e termina ao colocar ou cancelar', () => {
    const { state } = setup()
    state().toggleLayer('tolls')
    state().beginPlacement()
    expect(state().mode.kind).toBe('placing')
    expect(state().layers.tolls).toBe(true)
    state().cancelPlacement()
    expect(state().mode.kind).toBe('idle')

    state().beginPlacement()
    state().addToll('n15-porto-penafiel', 0.5)
    expect(state().mode.kind).toBe('idle')
  })

  it('repor volta à configuração inicial e pode ser anulado', () => {
    const { state } = setup()
    state().removeToll('toll-a3-maia')
    state().resetTolls()
    expect(state().tolls).toBe(demoNetwork.tolls)
    state().undo()
    expect(state().tolls).toHaveLength(5)
  })
})
