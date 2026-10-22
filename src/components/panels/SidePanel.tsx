import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { cx } from '../../utils/cx.ts'
import { OverviewPanel } from './OverviewPanel.tsx'
import { ScenariosPanel } from './ScenariosPanel.tsx'
import { SelectionPanel } from './SelectionPanel.tsx'
import { useMapStore } from '../../store/useMapStore.ts'

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
          {networkLoad.status === 'ready' ? (
            <ReadyPanel networkLoad={networkLoad} />
          ) : (
            <OverviewPanel networkLoad={networkLoad} />
          )}
        </div>
      </div>
    </aside>
  )
}

/** Com a rede válida: painel de cenários ou painel da seleção do mapa. */
function ReadyPanel({ networkLoad }: { networkLoad: NetworkLoadResult }) {
  const view = useMapStore((state) => state.panelView)
  return view === 'scenarios' ? <ScenariosPanel /> : <SelectionPanel networkLoad={networkLoad} />
}
