import { AlertTriangle, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button.tsx'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-2 text-center">
      {icon && (
        <div className="mb-2 flex size-16 items-center justify-center rounded-[1.5rem] bg-surface-raised text-accent shadow-float motion-safe:animate-float">
          {icon}
        </div>
      )}
      <p className="text-base font-extrabold text-ink">{title}</p>
      {description && <p className="text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <output className="flex flex-col items-center gap-2 text-center">
      <LoaderCircle aria-hidden="true" className="size-7 text-accent motion-safe:animate-spin" />
      <span className="text-xs font-semibold text-muted">{label}</span>
    </output>
  )
}

interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex max-w-sm flex-col items-center gap-2 text-center motion-safe:animate-fade-up">
      <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-alert-soft">
        <AlertTriangle aria-hidden="true" className="size-6 text-alert" />
      </div>
      <p className="text-sm font-extrabold text-ink">{title}</p>
      {description && <p className="text-xs text-muted">{description}</p>}
      {onRetry && (
        <Button size="sm" className="mt-2" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
