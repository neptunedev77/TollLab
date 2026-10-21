import { cx } from '../../utils/cx.ts'
import { OverviewPanel } from './OverviewPanel.tsx'

interface SidePanelProps {
  id: string
  open: boolean
}

/**
 * Painel lateral fixo ao lado do mapa (não sobreposto), por isso nunca tapa o mapa.
 * Quando fechado fica `inert`, fora da ordem de tabulação.
 */
export function SidePanel({ id, open }: SidePanelProps) {
  return (
    <aside
      id={id}
      aria-label="Painel lateral"
      inert={!open}
      className={cx(
        'shrink-0 overflow-hidden border-border bg-surface transition-[width] duration-200 ease-calm',
        open ? 'w-[var(--panel-width)] border-l' : 'w-0',
      )}
    >
      <div className="h-full w-[var(--panel-width)] overflow-y-auto">
        <OverviewPanel />
      </div>
    </aside>
  )
}
