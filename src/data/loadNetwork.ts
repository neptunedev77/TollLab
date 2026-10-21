import type { NetworkDataset } from '../domain/types.ts'
import { validateDataset, type ValidationIssue } from '../domain/validation.ts'
import { demoNetwork } from './demoNetwork.ts'

export type NetworkLoadResult =
  | { readonly status: 'ready'; readonly dataset: NetworkDataset }
  | { readonly status: 'invalid'; readonly issues: readonly ValidationIssue[] }

/** Valida um conjunto de dados antes de o disponibilizar à aplicação. Nunca devolve dados inválidos. */
export function loadNetwork(dataset: NetworkDataset = demoNetwork): NetworkLoadResult {
  const validation = validateDataset(dataset)
  return validation.ok ? { status: 'ready', dataset } : { status: 'invalid', issues: validation.issues }
}
