import { Play, RotateCcw } from 'lucide-react'
import { cx } from '../../utils/cx.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Tooltip } from '../ui/Tooltip.tsx'

const UNAVAILABLE = 'disponível quando o motor de simulação estiver ativo'
const SPEEDS = [1, 2, 4] as const

/**
 * Dock de simulação sobre o mapa. Os controlos continuam visíveis e focáveis, mas indisponíveis até
 * haver motor de simulação, para o layout final já poder ser validado.
 */
export function SimulationControls() {
  return (
    <div
      role="toolbar"
      aria-label="Controlos da simulação"
      className="flex items-center gap-1.5 rounded-full bg-surface-raised/95 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md"
    >
      <IconButton
        label="Iniciar simulação"
        variant="primary"
        size="lg"
        icon={<Play className="size-5 translate-x-px fill-current" />}
        unavailableReason={UNAVAILABLE}
      />
      <IconButton
        label="Reiniciar simulação"
        icon={<RotateCcw className="size-4" />}
        className="rounded-full"
        unavailableReason={UNAVAILABLE}
      />

      <Tooltip content={`Velocidade — ${UNAVAILABLE}`}>
        <fieldset className="flex gap-0.5 rounded-full bg-surface-muted p-1">
          <legend className="sr-only">Velocidade da simulação</legend>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={speed === 1}
              aria-disabled="true"
              className={cx(
                'h-7 min-w-9 cursor-not-allowed rounded-full px-2 text-xs font-extrabold tabular-nums',
                speed === 1 ? 'bg-surface-raised text-ink shadow-soft' : 'text-subtle',
              )}
            >
              {speed}x
            </button>
          ))}
        </fieldset>
      </Tooltip>

      <p className="flex items-center gap-1.5 pr-3 pl-1.5 text-xs font-bold text-muted">
        <span aria-hidden="true" className="size-2 rounded-full bg-subtle/60" />
        Simulação parada
      </p>
    </div>
  )
}
