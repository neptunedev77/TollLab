import { Play, RotateCcw } from 'lucide-react'
import { cx } from '../../utils/cx.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Tooltip } from '../ui/Tooltip.tsx'

const UNAVAILABLE = 'disponível quando o motor de simulação estiver ativo'
const SPEEDS = [1, 2, 4] as const

/**
 * Controlos de simulação sobre o mapa. Continuam visíveis e focáveis, mas indisponíveis até haver
 * motor de simulação, para o layout final já poder ser validado.
 */
export function SimulationControls() {
  return (
    <div
      role="toolbar"
      aria-label="Controlos da simulação"
      className="flex items-center gap-1 rounded-card border border-border bg-surface-raised p-1 shadow-float"
    >
      <IconButton label="Iniciar simulação" icon={<Play className="size-4" />} unavailableReason={UNAVAILABLE} />
      <IconButton label="Reiniciar simulação" icon={<RotateCcw className="size-4" />} unavailableReason={UNAVAILABLE} />

      <div aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <Tooltip content={`Velocidade — ${UNAVAILABLE}`}>
        <fieldset className="flex gap-0.5">
          <legend className="sr-only">Velocidade da simulação</legend>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={speed === 1}
              aria-disabled="true"
              className={cx(
                'h-8 cursor-not-allowed rounded-control px-2 text-xs font-medium tabular-nums opacity-50',
                speed === 1 ? 'bg-surface-muted text-ink' : 'text-muted',
              )}
            >
              {speed}x
            </button>
          ))}
        </fieldset>
      </Tooltip>

      <div aria-hidden="true" className="mx-1 h-5 w-px bg-border" />

      <p className="px-2 text-xs text-muted">Simulação parada</p>
    </div>
  )
}
