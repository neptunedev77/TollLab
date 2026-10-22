import { createContext, useContext, type RefObject } from 'react'
import type { Playback } from '../../simulation/playback.ts'

/**
 * Estado mutável partilhado entre o controlador de reprodução e a cena 3D. Não passa pelo React:
 * é lido a cada fotograma, por isso mudar estes campos não provoca novas renderizações.
 */
export interface PlaybackRuntime {
  engine: Playback | null
  /** Semente com que o motor atual foi criado (as partidas dependem dela). */
  engineSeed: number | null
  /** Minuto simulado a desenhar (contínuo; o motor avança em passos fixos até ele). */
  renderMinute: number
  /** Último instante (ms, `performance.now`) em que cada pórtico cobrou uma passagem. */
  readonly pulses: Map<string, number>
  /** Pede um novo fotograma à cena 3D (sem efeito se não houver cena). */
  invalidate(): void
  /**
   * A cena regista aqui a sua função de "novo fotograma"; devolve a função que cancela o registo.
   * Assim o controlador não importa o three.js e a cena continua num chunk carregado à parte.
   */
  registerInvalidate(callback: () => void): () => void
}

export function createPlaybackRuntime(): PlaybackRuntime {
  let callback: (() => void) | null = null
  return {
    engine: null,
    engineSeed: null,
    renderMinute: 0,
    pulses: new Map(),
    invalidate: () => callback?.(),
    registerInvalidate: (next) => {
      callback = next
      return () => {
        if (callback === next) callback = null
      }
    },
  }
}

/** O contexto passa o ref (estável); `.current` só deve ser lido fora do render (ex.: em `useFrame`). */
export const PlaybackContext = createContext<RefObject<PlaybackRuntime> | null>(null)

export function usePlaybackRuntime(): RefObject<PlaybackRuntime> | null {
  return useContext(PlaybackContext)
}

/** Cada veículo desenhado representa este número de veículos simulados (os totais contam todos). */
export const DRAW_EVERY = 4
/** Minutos simulados por segundo real à velocidade 1x (a hora de procura dura 1 minuto real). */
export const SIM_MINUTES_PER_SECOND = 1
/** Hora do dia em que começa a hora simulada (só para o relógio da interface). */
export const START_HOUR = 8
