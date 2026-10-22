import { CheckCircle2, CircleAlert, MousePointerClick, Undo2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useMapStore, useMapStoreApi } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'

const NOTICE_MS = 5000

/** Faixa do modo de colocação: explica o que fazer e permite cancelar. */
export function PlacementBanner() {
  const placing = useMapStore((state) => state.mode.kind === 'placing')
  const cancelPlacement = useMapStore((state) => state.cancelPlacement)
  if (!placing) return null

  return (
    <output className="flex w-max max-w-full items-center gap-2.5 rounded-full bg-accent py-1.5 pr-1.5 pl-4 text-xs font-bold text-white shadow-float motion-safe:animate-pop-in">
      <MousePointerClick aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">Clica numa estrada para colocar o pórtico</span>
      <Button size="sm" variant="secondary" onClick={cancelPlacement} className="ml-1 text-ink">
        Cancelar (Esc)
      </Button>
    </output>
  )
}

/** Notificação discreta das ações de edição, com "Anular" quando aplicável. */
export function NoticeToast() {
  const notice = useMapStore((state) => state.notice)
  const undoNotice = useMapStore((state) => state.undoNotice)
  const dismissNotice = useMapStore((state) => state.dismissNotice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismissNotice, NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice, dismissNotice])

  return (
    <div aria-live="polite" className="pointer-events-none flex justify-center">
      {notice && (
        <div
          key={notice.id}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 text-xs font-bold shadow-float ring-1 motion-safe:animate-pop-in',
            notice.tone === 'error' ? 'bg-alert-soft text-alert ring-alert/20' : 'bg-ink/95 text-white ring-black/10',
          )}
        >
          {notice.tone === 'error' ? (
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-flow-soft" />
          )}
          <span>{notice.message}</span>
          {notice.undoable && (
            <button
              type="button"
              onClick={undoNotice}
              className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 transition-colors hover:bg-white/25"
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              Anular
            </button>
          )}
          <IconButton
            label="Fechar notificação"
            icon={<X className="size-3.5" />}
            onClick={dismissNotice}
            className={cx('size-7 rounded-full', notice.tone === 'error' ? 'text-alert' : 'text-white hover:bg-white/15')}
          />
        </div>
      )}
    </div>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button'].includes(target.type)
}

/**
 * Atalhos globais de edição: Ctrl/⌘+Z anula, Ctrl/⌘+Shift+Z ou Ctrl+Y refaz, Esc cancela a
 * colocação. Dentro de campos de texto, os atalhos ficam para o próprio campo.
 */
export function EditorShortcuts() {
  const store = useMapStoreApi()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = store.getState()
      if (event.key === 'Escape' && state.mode.kind === 'placing') {
        event.preventDefault()
        state.cancelPlacement()
        return
      }
      if (isTypingTarget(event.target)) return
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        state.undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        state.redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store])

  return null
}
