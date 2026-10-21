import { PanelRightClose, PanelRightOpen, Waypoints } from 'lucide-react'
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
    <header className="z-20 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-2">
        <Waypoints aria-hidden="true" className="size-5 text-accent" />
        <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      <div aria-hidden="true" className="h-5 w-px bg-border" />

      <p className="truncate text-xs text-muted">
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
        />
      </div>
    </header>
  )
}
