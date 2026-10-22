import { createContext, useContext } from 'react'
import type { AssignmentResult } from '../simulation/assignment.ts'

export const AssignmentContext = createContext<AssignmentResult | null>(null)

/** Resultado atual do motor de percursos, ou `null` fora de um `AssignmentProvider`. */
export function useAssignment(): AssignmentResult | null {
  return useContext(AssignmentContext)
}
