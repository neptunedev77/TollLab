import { Layers2, PanelRightClose, PanelRightOpen, Waypoints } from 'lucide-react'
import { APP_NAME } from '../../appInfo.ts'
import { Badge } from '../ui/Badge.tsx'
import { IconButton } from '../ui/IconButton.tsx'

interface TopBarProps {
  panelOpen: boolean
  panelId: string
  onTogglePanel: () => void
}

export function TopBar({ panelOpen, panelId, onTogglePanel }: TopBarProps) {
  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 px-1.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-[0.7rem] bg-gradient-to-br from-accent to-accent-deep text-white shadow-key"
        >
          <Waypoints className="size-4.5" strokeWidth={2.4} />
        </span>
        <span className="text-base font-extrabold tracking-tight">{APP_NAME}</span>
      </div>

      <p className="flex items-center gap-1.5 truncate rounded-full bg-surface-raised/80 px-3 py-1.5 text-xs font-bold text-muted shadow-soft">
        <Layers2 aria-hidden="true" className="size-3.5 text-subtle" />
        <span className="sr-only">Cenário atual: </span>Cenário base
      </p>

      <div className="ml-auto flex items-center gap-2">
        <Badge tone="info">Modelo de demonstração</Badge>
        <IconButton
          label={panelOpen ? 'Fechar painel lateral' : 'Abrir painel lateral'}
          icon={panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          tooltipSide="bottom"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={onTogglePanel}
          className="bg-surface-raised/80 shadow-soft"
        />
      </div>
    </header>
  )
}
