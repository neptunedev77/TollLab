import { Pause, Play, RotateCcw } from 'lucide-react'
import { formatEuros } from '../../domain/money.ts'
import type { PlaybackSpeed, PlaybackStatus } from '../../store/mapStore.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { clockLabel, formatInteger } from '../../utils/format.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { DRAW_EVERY, START_HOUR } from './playbackContext.ts'

const SPEEDS: readonly PlaybackSpeed[] = [1, 2, 4]

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  idle: 'Simulação parada',
  running: 'Em curso',
  paused: 'Em pausa',
  finished: 'Concluída',
}

/** Dock de simulação sobre o mapa: iniciar/pausar, reiniciar, velocidade, relógio e resumo ao vivo. */
export function SimulationControls() {
  const playback = useMapStore((state) => state.playback)
  const play = useMapStore((state) => state.play)
  const pause = useMapStore((state) => state.pause)
  const restart = useMapStore((state) => state.restart)
  const setSpeed = useMapStore((state) => state.setSpeed)
  const { status, speed, stats } = playback
  const running = status === 'running'

  return (
    <div
      role="toolbar"
      aria-label="Controlos da simulação"
      className="flex items-center gap-1.5 rounded-full bg-surface-raised/95 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md"
    >
      <IconButton
        label={running ? 'Pausar simulação' : status === 'finished' ? 'Repetir simulação' : 'Iniciar simulação'}
        variant="primary"
        size="lg"
        icon={running ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
        onClick={running ? pause : play}
      />
      <IconButton
        label="Reiniciar simulação"
        icon={<RotateCcw className="size-4" />}
        className="rounded-full"
        unavailableReason={status === 'idle' ? 'a simulação já está no início' : undefined}
        onClick={restart}
      />

      <fieldset className="flex gap-0.5 rounded-full bg-surface-muted p-1">
        <legend className="sr-only">Velocidade da simulação</legend>
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            aria-label={`Velocidade ${value}x`}
            onClick={() => setSpeed(value)}
            className={cx(
              'h-7 min-w-9 rounded-full px-2 text-xs font-extrabold tabular-nums transition-[background-color,color,box-shadow] duration-200',
              speed === value ? 'bg-surface-raised text-ink shadow-soft' : 'text-subtle hover:text-ink',
            )}
          >
            {value}x
          </button>
        ))}
      </fieldset>

      <div className="flex items-center gap-2.5 pr-3 pl-1.5">
        <span className="text-sm font-extrabold tabular-nums text-ink" aria-label="Hora simulada">
          {clockLabel(stats?.minute ?? 0, START_HOUR)}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <span
              aria-hidden="true"
              className={cx(
                'size-2 rounded-full',
                running ? 'bg-flow motion-safe:animate-pulse' : status === 'finished' ? 'bg-accent' : 'bg-subtle/60',
              )}
            />
            {STATUS_LABEL[status]}
          </span>
          {stats && (
            <span className="text-[0.625rem] whitespace-nowrap text-subtle tabular-nums">
              {formatInteger(stats.travelling)} em circulação · {formatEuros(stats.grossCents)} cobrados
            </span>
          )}
        </span>
        <span className="sr-only">Cada veículo desenhado representa {DRAW_EVERY} veículos simulados.</span>
      </div>
    </div>
  )
}
