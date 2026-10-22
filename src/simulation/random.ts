/**
 * Gerador pseudoaleatório com semente (mulberry32). Rápido, sem dependências e reprodutível:
 * a mesma semente produz sempre a mesma sequência. `Math.random` nunca é usado no motor.
 */
export interface Random {
  /** Número em [0, 1). */
  next(): number
  /** Número em [min, max). */
  between(min: number, max: number): number
  /** Índice escolhido com probabilidade proporcional a `weights`. */
  weightedIndex(weights: readonly number[]): number
  /** Cópia baralhada (Fisher–Yates); não altera o original. */
  shuffle<T>(items: readonly T[]): T[]
}

export function createRandom(seed: number): Random {
  let state = Math.trunc(seed) >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    weightedIndex: (weights) => {
      const total = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0)
      if (total <= 0) return 0
      let target = next() * total
      for (let index = 0; index < weights.length; index++) {
        target -= Math.max(weights[index] ?? 0, 0)
        if (target < 0) return index
      }
      return weights.length - 1
    },
    shuffle: (items) => {
      const result = [...items]
      for (let index = result.length - 1; index > 0; index--) {
        const swap = Math.floor(next() * (index + 1))
        const current = result[index] as (typeof result)[number]
        result[index] = result[swap] as (typeof result)[number]
        result[swap] = current
      }
      return result
    },
  }
}
