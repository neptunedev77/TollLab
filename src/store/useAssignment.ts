import { createContext, useContext } from 'react'
import type { AssignmentResult } from '../simulation/assignment.ts'
import type { ChargingResult } from '../simulation/economics.ts'

export interface SimulationResults {
  readonly assignment: AssignmentResult
  readonly charging: ChargingResult
}

export const SimulationResultsContext = createContext<SimulationResults | null>(null)

/** Resultado atual do motor de percursos, ou `null` fora de um `AssignmentProvider`. */
export function useAssignment(): AssignmentResult | null {
  return useContext(SimulationResultsContext)?.assignment ?? null
}

/** Eventos de passagem e relatório de receitas do período, ou `null` fora de um `AssignmentProvider`. */
export function useCharging(): ChargingResult | null {
  return useContext(SimulationResultsContext)?.charging ?? null
}
