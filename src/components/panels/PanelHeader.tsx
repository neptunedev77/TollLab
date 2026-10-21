import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../ui/IconButton.tsx'

interface PanelHeaderProps {
  eyebrow: ReactNode
  title: string
  subtitle?: string
  titleId: string
  onBack: () => void
}

export function PanelHeader({ eyebrow, title, subtitle, titleId, onBack }: PanelHeaderProps) {
  return (
    <div className="flex items-start gap-2">
      <IconButton
        label="Voltar à visão geral"
        icon={<ArrowLeft className="size-4" />}
        tooltipSide="bottom"
        onClick={onBack}
        className="-ml-1.5 rounded-full"
      />
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <div className="flex items-center gap-1.5">{eyebrow}</div>
        <h2 id={titleId} className="text-lg leading-tight font-extrabold tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  )
}
