import { useEffect, useRef, type ReactNode } from 'react'
import { createPlayback } from '../../simulation/playback.ts'
import { useSimulationResults } from '../../store/useAssignment.ts'
import { useMapStore, useMapStoreApi } from '../../store/useMapStore.ts'
import { createPlaybackRuntime, PlaybackContext, SIM_MINUTES_PER_SECOND, type PlaybackRuntime } from './playbackContext.ts'

/** Frequência com que as estatísticas são copiadas para o store (a interface não precisa de 60 Hz). */
const STATS_INTERVAL_MS = 120
/** Passo real máximo por fotograma: depois de um separador em segundo plano, não "salta" minutos. */
const MAX_FRAME_SECONDS = 0.25

/**
 * Controlador da reprodução: tem o seu próprio ciclo `requestAnimationFrame`, separado do render.
 * A cada fotograma converte o tempo real em minutos simulados (× velocidade) e avança o motor em
 * passos fixos; a cena 3D apenas lê `renderMinute` e desenha. Pausa = o ciclo para.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const store = useMapStoreApi()
  const results = useSimulationResults()
  const dataset = useMapStore((state) => state.dataset)
  const seed = useMapStore((state) => state.seed)
  const status = useMapStore((state) => state.playback.status)
  const resetToken = useMapStore((state) => state.playback.resetToken)
  const runtimeRef = useRef<PlaybackRuntime>(createPlaybackRuntime())

  // Cria o motor na primeira vez; depois, cada novo resultado só atualiza o plano (sem interromper).
  useEffect(() => {
    const runtime = runtimeRef.current
    if (!results) return
    if (!runtime.engine) runtime.engine = createPlayback(dataset, results.assignment, results.tolls, seed)
    else runtime.engine.setPlan(results.assignment, results.tolls)
  }, [results, dataset, seed])

  // Reiniciar: volta ao minuto 0 e limpa o livro da reprodução.
  useEffect(() => {
    const runtime = runtimeRef.current
    runtime.engine?.reset()
    runtime.renderMinute = 0
    runtime.pulses.clear()
    runtime.invalidate()
  }, [resetToken])

  useEffect(() => {
    if (status !== 'running') return
    const runtime = runtimeRef.current
    let frame = 0
    let last = performance.now()
    let lastReport = 0
    const tick = (now: number) => {
      const engine = runtime.engine
      if (engine) {
        const seconds = Math.min((now - last) / 1000, MAX_FRAME_SECONDS)
        const speed = store.getState().playback.speed
        runtime.renderMinute = Math.min(runtime.renderMinute + seconds * speed * SIM_MINUTES_PER_SECOND, engine.endMinute)
        for (const event of engine.advanceTo(runtime.renderMinute)) runtime.pulses.set(event.tollId, now)
        if (now - lastReport > STATS_INTERVAL_MS || runtime.renderMinute >= engine.endMinute) {
          lastReport = now
          store.getState().reportPlayback(engine.stats())
        }
        runtime.invalidate()
      }
      last = now
      if (store.getState().playback.status === 'running') frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [status, store])

  return <PlaybackContext.Provider value={runtimeRef}>{children}</PlaybackContext.Provider>
}
