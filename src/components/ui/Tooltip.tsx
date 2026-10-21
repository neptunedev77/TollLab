import { cloneElement, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { positionFor, type TooltipSide } from '../../utils/tooltipPosition.ts'

interface TooltipProps {
  content: string
  side?: TooltipSide
  children: ReactElement<{ 'aria-describedby'?: string }>
}

/**
 * Tooltip leve que abre com hover ou foco de teclado e fecha com Escape.
 * O balão visual é desenhado num portal com posição fixa, para não ser cortado nem criar scroll em
 * contentores com overflow (ex.: painel lateral). A descrição acessível vive sempre junto ao alvo.
 */
export function Tooltip({ content, side = 'top', children }: TooltipProps) {
  const id = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<ReturnType<typeof positionFor> | null>(null)

  // Mede antes de pintar: o balão monta invisível, é posicionado e só depois fica visível.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return
    const tip = tipRef.current.getBoundingClientRect()
    setStyle(
      positionFor(anchorRef.current.getBoundingClientRect(), tip, side, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    )
  }, [open, side])

  const close = () => {
    setOpen(false)
    setStyle(null)
  }

  return (
    // O wrapper só recebe eventos delegados do elemento interativo filho (botão), que tem o papel semântico.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocus={() => setOpen(true)}
      onBlur={close}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} className="sr-only">
        {content}
      </span>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            aria-hidden="true"
            style={style ?? { left: 0, top: 0, visibility: 'hidden' }}
            className="pointer-events-none fixed z-50 w-max max-w-60 rounded-md bg-ink px-2 py-1 text-xs leading-snug text-white shadow-float motion-safe:animate-[tooltip-in_120ms_ease-out]"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  )
}
