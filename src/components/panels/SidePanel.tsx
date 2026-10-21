import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { cx } from '../../utils/cx.ts'
import { OverviewPanel } from './OverviewPanel.tsx'

interface SidePanelProps {
  id: string
  open: boolean
  networkLoad: NetworkLoadResult
}

/**
 * Painel lateral em "ilha" ao lado do mapa (não sobreposto), por isso nunca tapa o mapa.
 * Abre e fecha a deslizar; quando fechado fica `inert`, fora da ordem de tabulação.
 */
export function SidePanel({ id, open, networkLoad }: SidePanelProps) {
  return (
    <aside
      id={id}
      aria-label="Painel lateral"
      inert={!open}
      className={cx(
        'shrink-0 transition-[width,margin] duration-300 ease-calm',
        // Aberto fica visível para não cortar a sombra; fechado esconde o cartão que desliza.
        open ? 'ml-[var(--island-gap)] w-[var(--panel-width)] overflow-visible' : 'ml-0 w-0 overflow-hidden',
      )}
    >
      <div
        className={cx(
          'h-full w-[var(--panel-width)] overflow-hidden rounded-island bg-surface shadow-island ring-1 ring-border/80',
          'transition-[transform,opacity] duration-300 ease-calm',
          open ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
        )}
      >
        <div className="h-full overflow-y-auto">
          <OverviewPanel networkLoad={networkLoad} />
        </div>
      </div>
    </aside>
  )
}
