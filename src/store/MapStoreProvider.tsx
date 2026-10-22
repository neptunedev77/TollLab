import { useState, type ReactNode } from 'react'
import type { NetworkDataset } from '../domain/types.ts'
import { AssignmentProvider } from './AssignmentProvider.tsx'
import { createMapStore, type MapStoreOptions } from './mapStore.ts'
import { MapStoreContext } from './useMapStore.ts'

interface MapStoreProviderProps {
  dataset: NetworkDataset
  options?: MapStoreOptions
  children: ReactNode
}

/** Cada provider tem o seu próprio store (isola instâncias e testes) e o resultado do motor de percursos. */
export function MapStoreProvider({ dataset, options, children }: MapStoreProviderProps) {
  const [store] = useState(() => createMapStore(dataset, options))
  return (
    <MapStoreContext.Provider value={store}>
      <AssignmentProvider>{children}</AssignmentProvider>
    </MapStoreContext.Provider>
  )
}
