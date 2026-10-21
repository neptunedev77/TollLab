import { useState, type ReactNode } from 'react'
import type { NetworkDataset } from '../domain/types.ts'
import { createMapStore, type MapStoreOptions } from './mapStore.ts'
import { MapStoreContext } from './useMapStore.ts'

interface MapStoreProviderProps {
  dataset: NetworkDataset
  options?: MapStoreOptions
  children: ReactNode
}

/** Cada provider tem o seu próprio store: isola instâncias da aplicação e testes. */
export function MapStoreProvider({ dataset, options, children }: MapStoreProviderProps) {
  const [store] = useState(() => createMapStore(dataset, options))
  return <MapStoreContext.Provider value={store}>{children}</MapStoreContext.Provider>
}
