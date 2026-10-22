/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, demoDemand } from '../../data/demoDemand.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { setTollTariff } from '../../domain/tolls.ts'
import type { TollPoint } from '../../domain/types.ts'
import { compareScenarios } from '../../scenarios/compare.ts'
import { BACKUP_KEY, loadScenarios, saveScenarios, STORAGE_KEY, type KeyValueStorage } from '../../scenarios/persistence.ts'
import {
  createScenario,
  duplicateScenario,
  nextScenarioName,
  runScenario,
  sameConfiguration,
  SCENARIO_SCHEMA_VERSION,
  uniqueScenarioName,
  updateScenario,
} from '../../scenarios/scenario.ts'
import { createMapStore } from '../../store/mapStore.ts'

const fixedNow = () => new Date('2026-10-22T10:00:00Z')
const base = { name: 'Base', tolls: demoNetwork.tolls, demand: demoDemand, seed: DEFAULT_SEED }

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const withTariff = (cents: number): readonly TollPoint[] => {
  const edit = setTollTariff(demoNetwork, demoNetwork.tolls, 'toll-a3-maia', 'c1', cents)
  if (!edit.ok) throw new Error(edit.message)
  return edit.tolls
}

describe('cenários: isolamento e cópia profunda', () => {
  it('um cenário é uma cópia congelada que não partilha objetos com a origem', () => {
    const tolls = structuredClone(demoNetwork.tolls) as TollPoint[]
    const scenario = createScenario(demoNetwork, { ...base, tolls }, { now: fixedNow })
    expect(scenario.tolls).not.toBe(tolls)
    expect(scenario.tolls[0]).not.toBe(tolls[0])
    expect(Object.isFrozen(scenario.tolls[0]?.tariffCents)).toBe(true)

    // Alterar o objeto de origem não altera o cenário.
    ;(tolls[0] as { name: string }).name = 'alterado'
    expect(scenario.tolls[0]?.name).not.toBe('alterado')
    // E o próprio cenário não pode ser alterado por acidente.
    expect(() => {
      ;(scenario.tolls[0] as { name: string }).name = 'x'
    }).toThrow(TypeError)
  })

  it('duplicar e editar a cópia não altera o original', () => {
    const original = createScenario(demoNetwork, base, { now: fixedNow })
    const copy = duplicateScenario(original, 'Cópia', { now: fixedNow })
    const edited = updateScenario(demoNetwork, copy, { tolls: withTariff(500) }, fixedNow)

    expect(copy.id).not.toBe(original.id)
    expect(original.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)
    expect(edited.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(500)
    expect(original.results).toEqual(copy.results)
    expect(edited.results.grossCents).not.toBe(original.results.grossCents)
  })

  it('os resultados guardados são os do motor e são reprodutíveis', () => {
    const scenario = createScenario(demoNetwork, base, { now: fixedNow })
    expect(scenario.results).toEqual(runScenario(demoNetwork, demoNetwork.tolls, demoDemand, DEFAULT_SEED, undefined, fixedNow))
    expect(scenario.results).toMatchObject({ vehicles: 7000, routed: 7000, grossCents: 910_182, netCents: 856_358 })
  })

  it('nomes: seguinte livre e únicos', () => {
    const a = createScenario(demoNetwork, { ...base, name: 'Cenário 1' }, { now: fixedNow })
    expect(nextScenarioName([a])).toBe('Cenário 2')
    expect(uniqueScenarioName([a], 'Cenário 1')).toBe('Cenário 1 (2)')
    expect(uniqueScenarioName([a], 'Outro')).toBe('Outro')
  })

  it('sameConfiguration deteta alterações de pórticos e semente', () => {
    const scenario = createScenario(demoNetwork, base, { now: fixedNow })
    expect(sameConfiguration(scenario, base)).toBe(true)
    expect(sameConfiguration(scenario, { ...base, seed: 1 })).toBe(false)
    expect(sameConfiguration(scenario, { ...base, tolls: withTariff(300) })).toBe(false)
  })
})

describe('persistência', () => {
  const context = { dataset: demoNetwork, defaultDemand: demoDemand, now: fixedNow }

  it('guarda e volta a ler os mesmos cenários (envelope versionado)', () => {
    const storage = memoryStorage()
    const scenarios = [createScenario(demoNetwork, base, { now: fixedNow }), createScenario(demoNetwork, { ...base, name: 'B', tolls: withTariff(400) }, { now: fixedNow })]
    expect(saveScenarios(storage, scenarios)).toEqual({ ok: true })
    expect(JSON.parse(storage.data[STORAGE_KEY] ?? '{}')).toMatchObject({ app: 'tolllab', version: SCENARIO_SCHEMA_VERSION })

    const loaded = loadScenarios(storage, context)
    expect(loaded.warnings).toEqual([])
    expect(loaded.canSave).toBe(true)
    expect(loaded.scenarios).toEqual(scenarios)
  })

  it('sem dados guardados: lista vazia, sem avisos', () => {
    expect(loadScenarios(memoryStorage(), context)).toEqual({ scenarios: [], warnings: [], canSave: true })
  })

  it('JSON corrompido: ignora, guarda uma cópia de segurança e não bloqueia', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{"version": 2, "scenarios": [' })
    const loaded = loadScenarios(storage, context)
    expect(loaded.scenarios).toEqual([])
    expect(loaded.canSave).toBe(true)
    expect(loaded.warnings[0]).toMatch(/corrompidos/)
    expect(storage.data[BACKUP_KEY]).toBe('{"version": 2, "scenarios": [')
  })

  it('formatos desconhecidos e listas mistas: descarta só o que é inválido, com aviso', () => {
    const good = createScenario(demoNetwork, base, { now: fixedNow })
    const badTariff = { ...structuredClone(good), id: 'bad-1', name: 'Tarifa negativa', tolls: [{ ...structuredClone(good.tolls[0]), tariffCents: { c1: -5, c2: 0, c3: 0, c4: 0 } }] }
    const otherNetwork = { ...structuredClone(good), id: 'bad-2', name: 'Outra rede', datasetId: 'outra' }
    const brokenShape = { id: 'bad-3', name: 'Sem pórticos' }
    const duplicate = { ...structuredClone(good), name: 'Repetido' }
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 2, scenarios: [good, badTariff, otherNetwork, brokenShape, duplicate] }),
    })

    const loaded = loadScenarios(storage, context)
    expect(loaded.scenarios.map((s) => s.id)).toEqual([good.id])
    expect(loaded.warnings).toHaveLength(4)
    expect(loaded.warnings.join(' ')).toMatch(/Tarifa negativa.*negativa/)
    expect(loaded.warnings.join(' ')).toMatch(/Outra rede.*outra rede/)
    expect(loaded.warnings.join(' ')).toMatch(/ID repetido/)

    expect(loadScenarios(memoryStorage({ [STORAGE_KEY]: '"texto"' }), context).warnings[0]).toMatch(/não são de cenários/)
  })

  it('resultados em falta ou estragados são recalculados com o motor', () => {
    const good = createScenario(demoNetwork, base, { now: fixedNow })
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, scenarios: [{ ...good, results: { lixo: true } }] }) })
    expect(loadScenarios(storage, context).scenarios[0]?.results).toEqual(good.results)
  })

  it('migra o formato v1 (sem procura nem resultados)', () => {
    const v1 = { version: 1, items: [{ id: 'old-1', name: 'Antigo', savedAt: '2026-01-01T00:00:00Z', tolls: withTariff(250), seed: 7 }] }
    const loaded = loadScenarios(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v1) }), context)
    expect(loaded.warnings).toEqual(['Os cenários foram convertidos de uma versão anterior.'])
    const [scenario] = loaded.scenarios
    expect(scenario).toMatchObject({ id: 'old-1', name: 'Antigo', seed: 7, datasetId: demoNetwork.id, schemaVersion: 2 })
    expect(scenario?.demand).toEqual(demoDemand)
    expect(scenario?.results).toEqual(runScenario(demoNetwork, withTariff(250), demoDemand, 7, undefined, fixedNow))
  })

  it('uma versão mais recente não é lida nem sobrescrita', () => {
    const loaded = loadScenarios(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, scenarios: [] }) }), context)
    expect(loaded).toMatchObject({ scenarios: [], canSave: false })
    expect(loaded.warnings[0]).toMatch(/versão mais recente/)
  })

  it('armazenamento indisponível ou cheio: avisa sem lançar exceções', () => {
    expect(loadScenarios(null, context).canSave).toBe(false)
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadScenarios(throwing, context).warnings[0]).toMatch(/Não foi possível ler/)
    expect(saveScenarios(throwing, [])).toEqual({ ok: false, message: 'Não foi possível guardar os cenários (armazenamento cheio ou bloqueado).' })
  })
})

describe('comparação', () => {
  const a = createScenario(demoNetwork, { ...base, name: 'A' }, { now: fixedNow })

  it('um cenário comparado consigo próprio não tem diferenças', () => {
    const comparison = compareScenarios(a, duplicateScenario(a, 'A2', { now: fixedNow }))
    expect(comparison.comparable).toBe(true)
    expect(comparison.cautions).toEqual([])
    expect(comparison.tollDifferences).toBe(0)
    expect(comparison.metrics.every((metric) => metric.delta === 0)).toBe(true)
  })

  it('resultado conhecido: subir a tarifa da A3 Maia muda receita e desvios como o motor calcula', () => {
    const b = createScenario(demoNetwork, { ...base, name: 'B', tolls: withTariff(800) }, { now: fixedNow })
    const expectedB = runScenario(demoNetwork, withTariff(800), demoDemand, DEFAULT_SEED)
    const comparison = compareScenarios(a, b)
    const metric = (key: string) => comparison.metrics.find((m) => m.key === key)

    expect(comparison.comparable).toBe(true)
    expect(comparison.tollDifferences).toBe(1)
    expect(metric('grossCents')).toMatchObject({ a: 910_182, b: expectedB.grossCents, delta: expectedB.grossCents - 910_182 })
    expect(metric('avoidingTolls')?.delta).toBe(expectedB.avoidingTolls - a.results.avoidingTolls)
    expect(metric('avoidingTolls')?.delta).toBeGreaterThan(0)
    expect(metric('grossCents')?.deltaRatio).toBeCloseTo((expectedB.grossCents - 910_182) / 910_182)
  })

  it('procuras diferentes: não comparáveis; sementes diferentes: aviso', () => {
    const otherDemand = { ...demoDemand, classShares: { c1: 0.8, c2: 0.1, c3: 0.05, c4: 0.05 } }
    const differentDemand = createScenario(demoNetwork, { ...base, demand: otherDemand }, { now: fixedNow })
    expect(compareScenarios(a, differentDemand)).toMatchObject({ comparable: false, blockers: ['Os cenários usam procuras diferentes.'] })

    const otherSeed = createScenario(demoNetwork, { ...base, seed: 99 }, { now: fixedNow })
    const comparison = compareScenarios(a, otherSeed)
    expect(comparison.comparable).toBe(true)
    expect(comparison.cautions[0]).toMatch(/Sementes diferentes \(2026 e 99\)/)
  })
})

describe('store: cenários', () => {
  const setup = (storage = memoryStorage()) => {
    const store = createMapStore(demoNetwork, { animate: false, storage })
    return { store, state: () => store.getState(), storage }
  }

  it('guardar, editar e voltar a carregar: o cenário guardado nunca muda com as edições', () => {
    const { state } = setup()
    const id = state().saveScenarioAs('Base')
    state().setTollTariff('toll-a3-maia', 'c1', 999)
    const saved = state().scenarios.find((s) => s.id === id)
    expect(saved?.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)

    state().loadScenario(id ?? '')
    expect(state().tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)
    expect(state().activeScenarioId).toBe(id)

    state().setTollTariff('toll-a3-maia', 'c1', 111)
    expect(state().scenarios.find((s) => s.id === id)?.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)
  })

  it('dois cenários independentes: atualizar um não altera o outro', () => {
    const { state } = setup()
    const first = state().saveScenarioAs('A')
    state().setTollTariff('toll-a3-maia', 'c1', 600)
    const second = state().saveScenarioAs('B')
    state().setTollTariff('toll-a3-maia', 'c1', 900)
    state().saveActiveScenario()

    const byId = (id: string | null) => state().scenarios.find((s) => s.id === id)
    expect(byId(first)?.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(185)
    expect(byId(second)?.tolls.find((t) => t.id === 'toll-a3-maia')?.tariffCents.c1).toBe(900)
  })

  it('persiste cada alteração e volta a carregar ao criar um store novo', () => {
    const { state, storage } = setup()
    state().saveScenarioAs('Persistido')
    state().duplicateScenario(state().scenarios[0]?.id ?? '')
    const reopened = createMapStore(demoNetwork, { animate: false, storage })
    expect(reopened.getState().scenarios.map((s) => s.name)).toEqual(['Persistido', 'Persistido (cópia)'])
  })

  it('renomear e apagar (com "Anular" a repor o cenário)', () => {
    const { state } = setup()
    const id = state().saveScenarioAs('Velho') ?? ''
    state().renameScenario(id, '  Novo nome  ')
    expect(state().scenarios[0]?.name).toBe('Novo nome')

    state().deleteScenario(id)
    expect(state().scenarios).toHaveLength(0)
    expect(state().activeScenarioId).toBeNull()
    state().undoNotice()
    expect(state().scenarios.map((s) => s.name)).toEqual(['Novo nome'])
  })

  it('a semente só aceita inteiros válidos e reinicia a reprodução', () => {
    const { state } = setup()
    const token = state().playback.resetToken
    expect(state().setSeed(-1)).toBe(false)
    expect(state().setSeed(1.5)).toBe(false)
    expect(state().setSeed(42)).toBe(true)
    expect(state().seed).toBe(42)
    expect(state().playback.resetToken).toBe(token + 1)
  })

  it('arranca com avisos (sem bloquear) quando os dados guardados estão corrompidos', () => {
    const { state } = setup(memoryStorage({ [STORAGE_KEY]: 'not json' }))
    expect(state().scenarios).toEqual([])
    expect(state().scenarioWarnings[0]).toMatch(/corrompidos/)
  })
})
