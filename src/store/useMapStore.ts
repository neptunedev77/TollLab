import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { MapState, MapStore } from './mapStore.ts'

export const MapStoreContext = createContext<MapStore | null>(null)

export function useMapStoreApi(): MapStore {
  const store = useContext(MapStoreContext)
  if (!store) throw new Error('useMapStore tem de ser usado dentro de <MapStoreProvider>.')
  return store
}

/** Subscreve só a parte do estado que o componente usa. */
export function useMapStore<T>(selector: (state: MapState) => T): T {
  return useStore(useMapStoreApi(), selector)
}
