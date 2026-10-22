import { createContext, useContext } from 'react'
import type { TollPoint } from '../domain/types.ts'
import type { AssignmentResult } from '../simulation/assignment.ts'
import type { ChargingResult } from '../simulation/economics.ts'

export interface SimulationResults {
  /** Pórticos com que estes resultados foram calculados (podem estar ligeiramente atrás do store). */
  readonly tolls: readonly TollPoint[]
  readonly assignment: AssignmentResult
  readonly charging: ChargingResult
}

export const SimulationResultsContext = createContext<SimulationResults | null>(null)

export function useSimulationResults(): SimulationResults | null {
  return useContext(SimulationResultsContext)
}

/** Resultado atual do motor de percursos, ou `null` fora de um `AssignmentProvider`. */
export function useAssignment(): AssignmentResult | null {
  return useContext(SimulationResultsContext)?.assignment ?? null
}

/** Eventos de passagem e relatório de receitas do período, ou `null` fora de um `AssignmentProvider`. */
export function useCharging(): ChargingResult | null {
  return useContext(SimulationResultsContext)?.charging ?? null
}
