import { lazy, Suspense, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useMapStoreApi } from '../../store/useMapStore.ts'
import { cx } from '../../utils/cx.ts'
import { isWebGLAvailable } from '../scene3d/webgl.ts'
import { ErrorState, LoadingState } from '../ui/StateViews.tsx'
import { MapLabels } from './MapLabels.tsx'

// A cena 3D (three.js) é carregada à parte, para a interface abrir sem esperar por ela.
const MapScene = lazy(() => import('../scene3d/MapScene.tsx'))

export const KEYBOARD_PAN_PX = 80
export const ZOOM_STEP = 1.35

/**
 * Superfície interativa do mapa: pan por arrasto, zoom com a roda (em torno do cursor) e
 * navegação por teclado. A vista vive no store; a cena 3D e os rótulos limitam-se a segui-la.
 */
export function MapViewport() {
  const store = useMapStoreApi()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragDistanceRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [webgl] = useState(isWebGLAvailable)
  const helpId = useId()

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      store.getState().setViewport({ width: rect.width, height: rect.height })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [store])

  // A roda precisa de um listener não passivo para impedir o zoom/scroll da página.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      // ctrl + roda é o gesto de pinça dos trackpads: mais sensível.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015))
      store.getState().zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [store])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragDistanceRef.current = 0
    let lastX = event.clientX
    let lastY = event.clientY

    // Listeners na janela (sem pointer capture), para a cena 3D continuar a receber os cliques.
    const onMove = (move: globalThis.PointerEvent) => {
      const dx = move.clientX - lastX
      const dy = move.clientY - lastY
      lastX = move.clientX
      lastY = move.clientY
      dragDistanceRef.current += Math.hypot(dx, dy)
      if (dragDistanceRef.current > 3) setDragging(true)
      store.getState().panBy(dx, dy)
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const state = store.getState()
    const actions: Record<string, () => void> = {
      ArrowLeft: () => state.panBy(KEYBOARD_PAN_PX, 0),
      ArrowRight: () => state.panBy(-KEYBOARD_PAN_PX, 0),
      ArrowUp: () => state.panBy(0, KEYBOARD_PAN_PX),
      ArrowDown: () => state.panBy(0, -KEYBOARD_PAN_PX),
      '+': () => state.zoomBy(ZOOM_STEP),
      '=': () => state.zoomBy(ZOOM_STEP),
      '-': () => state.zoomBy(1 / ZOOM_STEP),
      '0': () => state.recenter(),
      Home: () => state.recenter(),
      Escape: () => state.clearSelection(),
    }
    const action = actions[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
  }

  return (
    // Widget próprio (mapa 2.5D): precisa de foco e de tratar teclado e ponteiro diretamente.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={containerRef}
      role="application"
      aria-roledescription="mapa"
      aria-label="Mapa interativo da rede"
      aria-describedby={helpId}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cx(
        'absolute inset-0 touch-none outline-none select-none',
        'focus-visible:shadow-[inset_0_0_0_3px_var(--color-focus)]',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      {webgl ? (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingState label="A preparar o mapa…" />
            </div>
          }
        >
          <MapScene dragDistanceRef={dragDistanceRef} />
        </Suspense>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <ErrorState
            title="O mapa precisa de WebGL"
            description="Este browser ou dispositivo não permite desenhar o mapa 3D. Experimenta um browser atualizado com aceleração gráfica ativa."
          />
        </div>
      )}
      <MapLabels />
      <p id={helpId} className="sr-only">
        Arrasta para mover o mapa e usa a roda do rato para aproximar ou afastar. Com o mapa focado: setas para
        mover, mais e menos para zoom, zero para recentrar e Escape para limpar a seleção. Os nomes das cidades
        são botões que selecionam a cidade.
      </p>
    </div>
  )
}
