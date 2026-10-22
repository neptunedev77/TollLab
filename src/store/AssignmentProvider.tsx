import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { assignTraffic } from '../simulation/assignment.ts'
import { AssignmentContext } from './useAssignment.ts'
import { useMapStore } from './useMapStore.ts'

/**
 * Calcula a afetação de tráfego uma única vez para toda a interface, sempre que os pórticos, a
 * procura ou a semente mudam. O cálculo usa um valor diferido: enquanto o utilizador arrasta um
 * slider, a interface continua fluida e os resultados atualizam logo a seguir.
 */
export function AssignmentProvider({ children }: { children: ReactNode }) {
  const dataset = useMapStore((state) => state.dataset)
  const tolls = useDeferredValue(useMapStore((state) => state.tolls))
  const demand = useMapStore((state) => state.demand)
  const seed = useMapStore((state) => state.seed)

  const result = useMemo(() => assignTraffic(dataset, tolls, demand, { seed }), [dataset, tolls, demand, seed])
  return <AssignmentContext.Provider value={result}>{children}</AssignmentContext.Provider>
}
