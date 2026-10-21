export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

const GAP = 8
const VIEWPORT_MARGIN = 8

interface Size {
  width: number
  height: number
}

/** Posição do balão junto ao alvo, mantida sempre dentro da janela. */
export function positionFor(anchor: DOMRect, tip: Size, side: TooltipSide, viewport: Size) {
  let left: number
  let top: number
  switch (side) {
    case 'top':
      left = anchor.left + anchor.width / 2 - tip.width / 2
      top = anchor.top - GAP - tip.height
      break
    case 'bottom':
      left = anchor.left + anchor.width / 2 - tip.width / 2
      top = anchor.bottom + GAP
      break
    case 'left':
      left = anchor.left - GAP - tip.width
      top = anchor.top + anchor.height / 2 - tip.height / 2
      break
    case 'right':
      left = anchor.right + GAP
      top = anchor.top + anchor.height / 2 - tip.height / 2
      break
  }
  const clamp = (value: number, max: number) => Math.min(Math.max(value, VIEWPORT_MARGIN), max - VIEWPORT_MARGIN)
  return {
    left: clamp(left, viewport.width - tip.width),
    top: clamp(top, viewport.height - tip.height),
  }
}
