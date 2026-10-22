import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { assignTraffic } from '../simulation/assignment.ts'
import { chargePeriod } from '../simulation/economics.ts'
import { SimulationResultsContext } from './useAssignment.ts'
import { useMapStore } from './useMapStore.ts'

/**
 * Calcula uma única vez para toda a interface a afetação de tráfego e a cobrança do período, sempre
 * que os pórticos, a procura ou a semente mudam. Usa um valor diferido: enquanto o utilizador arrasta
 * um slider, a interface continua fluida e os resultados atualizam logo a seguir.
 */
export function AssignmentProvider({ children }: { children: ReactNode }) {
  const dataset = useMapStore((state) => state.dataset)
  const tolls = useDeferredValue(useMapStore((state) => state.tolls))
  const demand = useMapStore((state) => state.demand)
  const seed = useMapStore((state) => state.seed)

  const results = useMemo(() => {
    const assignment = assignTraffic(dataset, tolls, demand, { seed })
    return { tolls, assignment, charging: chargePeriod(dataset, tolls, assignment) }
  }, [dataset, tolls, demand, seed])

  return <SimulationResultsContext.Provider value={results}>{children}</SimulationResultsContext.Provider>
}
