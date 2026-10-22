import type { Scenario, ScenarioResults } from './scenario.ts'

/*
 * Comparação de dois cenários a partir dos resultados do motor.
 *
 * Só é uma comparação "justa" quando os pressupostos que não estão a ser testados são iguais:
 *  - mesma rede e mesma procura → comparáveis; caso contrário a interface avisa que não são;
 *  - sementes diferentes → comparáveis, mas parte da diferença pode ser variação aleatória.
 */

export type MetricKey = 'grossCents' | 'netCents' | 'passages' | 'routed' | 'avoidingTolls' | 'averageTimeMin' | 'noRoute'

export interface MetricComparison {
  readonly key: MetricKey
  readonly label: string
  readonly unit: 'cents' | 'vehicles' | 'minutes' | 'count'
  readonly a: number | null
  readonly b: number | null
  /** b − a, ou `null` se um dos valores faltar. */
  readonly delta: number | null
  /** (b − a) / a, ou `null` se a for 0 ou faltar. */
  readonly deltaRatio: number | null
  /** Um aumento é bom (receita), mau (tempo) ou neutro (tráfego). */
  readonly better: 'higher' | 'lower' | 'neutral'
}

export interface ScenarioComparison {
  readonly comparable: boolean
  /** Razões que impedem a comparação (rede ou procura diferentes). */
  readonly blockers: readonly string[]
  /** Avisos que não impedem a comparação (ex.: sementes diferentes). */
  readonly cautions: readonly string[]
  readonly metrics: readonly MetricComparison[]
  /** Pórticos que existem só num dos cenários ou cujo estado/tarifa difere. */
  readonly tollDifferences: number
}

const METRICS: ReadonlyArray<Pick<MetricComparison, 'key' | 'label' | 'unit' | 'better'>> = [
  { key: 'grossCents', label: 'Receita bruta', unit: 'cents', better: 'higher' },
  { key: 'netCents', label: 'Resultado líquido estimado', unit: 'cents', better: 'higher' },
  { key: 'passages', label: 'Passagens cobradas', unit: 'count', better: 'neutral' },
  { key: 'routed', label: 'Tráfego (veículos com percurso)', unit: 'vehicles', better: 'neutral' },
  { key: 'avoidingTolls', label: 'Veículos que evitam portagens', unit: 'vehicles', better: 'lower' },
  { key: 'averageTimeMin', label: 'Tempo médio de viagem', unit: 'minutes', better: 'lower' },
  { key: 'noRoute', label: 'Veículos sem percurso', unit: 'vehicles', better: 'lower' },
]

const valueOf = (results: ScenarioResults, key: MetricKey): number | null => results[key]

export function compareScenarios(a: Scenario, b: Scenario): ScenarioComparison {
  const blockers: string[] = []
  const cautions: string[] = []
  if (a.datasetId !== b.datasetId) blockers.push('Os cenários usam redes diferentes.')
  if (JSON.stringify(a.demand) !== JSON.stringify(b.demand)) blockers.push('Os cenários usam procuras diferentes.')
  if (a.seed !== b.seed) {
    cautions.push(`Sementes diferentes (${a.seed} e ${b.seed}): parte das diferenças pode ser variação aleatória do modelo.`)
  }

  const metrics = METRICS.map((metric) => {
    const valueA = valueOf(a.results, metric.key)
    const valueB = valueOf(b.results, metric.key)
    const delta = valueA === null || valueB === null ? null : valueB - valueA
    return {
      ...metric,
      a: valueA,
      b: valueB,
      delta,
      deltaRatio: delta === null || valueA === null || valueA === 0 ? null : delta / valueA,
    }
  })

  const key = (toll: Scenario['tolls'][number]) => JSON.stringify([toll.edgeId, toll.position, toll.active, toll.tariffCents])
  const inA = new Map(a.tolls.map((toll) => [toll.id, key(toll)]))
  const inB = new Map(b.tolls.map((toll) => [toll.id, key(toll)]))
  let tollDifferences = 0
  for (const [id, value] of inA) if (inB.get(id) !== value) tollDifferences++
  for (const id of inB.keys()) if (!inA.has(id)) tollDifferences++

  return { comparable: blockers.length === 0, blockers, cautions, metrics, tollDifferences }
}
