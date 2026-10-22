import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapStage } from '../components/map/MapStage.tsx'
import { demoNetwork } from '../data/demoNetwork.ts'
import { loadNetwork } from '../data/loadNetwork.ts'
import type { MapState } from '../store/mapStore.ts'
import { MapStoreProvider } from '../store/MapStoreProvider.tsx'
import { useMapStoreApi } from '../store/useMapStore.ts'

vi.mock('../components/scene3d/webgl.ts', () => ({ isWebGLAvailable: () => true }))
vi.mock('../components/scene3d/MapScene.tsx', () => ({ default: () => <div data-testid="map-scene" /> }))

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 700))
})
afterEach(() => vi.restoreAllMocks())

/** Expõe o estado do store ao teste, para verificar a vista sem depender do WebGL. */
function renderStage(onState: (get: () => MapState) => void) {
  function Spy({ children }: { children: ReactNode }) {
    const store = useMapStoreApi()
    useEffect(() => onState(store.getState), [store])
    return children
  }
  render(
    <MapStoreProvider dataset={demoNetwork} options={{ animate: false }}>
      <Spy>
        <MapStage networkLoad={loadNetwork()} />
      </Spy>
    </MapStoreProvider>,
  )
}

function setup() {
  let getState: () => MapState = () => {
    throw new Error('store indisponível')
  }
  renderStage((get) => {
    getState = get
  })
  return () => getState()
}

describe('navegação do mapa', () => {
  it('enquadra a rede ao conhecer o tamanho do viewport', () => {
    const state = setup()
    expect(state().viewport).toEqual({ width: 1000, height: 700 })
    expect(state().view).not.toBeNull()
  })

  it('aproxima e afasta com os botões', async () => {
    const user = userEvent.setup()
    const state = setup()
    const initial = state().view?.zoom ?? 0

    await user.click(screen.getByRole('button', { name: 'Aproximar' }))
    expect(state().view?.zoom).toBeCloseTo(initial * 1.35)
    await user.click(screen.getByRole('button', { name: 'Afastar' }))
    expect(state().view?.zoom).toBeCloseTo(initial)
  })

  it('move, aproxima e recentra pelo teclado', async () => {
    const user = userEvent.setup()
    const state = setup()
    const home = state().view
    screen.getByRole('application', { name: 'Mapa interativo da rede' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(state().view?.centerX).toBeGreaterThan(home?.centerX ?? 0)
    await user.keyboard('{ArrowUp}')
    expect(state().view?.centerY).toBeLessThan(home?.centerY ?? 0)
    await user.keyboard('+')
    expect(state().view?.zoom).toBeGreaterThan(home?.zoom ?? 0)

    await user.keyboard('0')
    expect(state().view).toEqual(home)
  })

  it('recentra com o botão depois de mover o mapa', async () => {
    const user = userEvent.setup()
    const state = setup()
    const home = state().view
    state().panBy(200, -150)
    expect(state().view).not.toEqual(home)

    await user.click(screen.getByRole('button', { name: 'Recentrar mapa' }))
    expect(state().view).toEqual(home)
  })

  it('esconde os rótulos pela camada "Nomes das cidades"', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByRole('button', { name: 'Braga' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Camadas' }))
    await user.click(screen.getByRole('switch', { name: 'Nomes das cidades' }))
    expect(screen.queryByRole('button', { name: 'Braga' })).not.toBeInTheDocument()
  })

  it('o menu de camadas escolhe a cor das estradas, fecha com Escape e atualiza a legenda', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Camadas' }))

    expect(screen.getByRole('radio', { name: 'Classe da via' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Preço' }))
    expect(screen.getByRole('radio', { name: 'Preço' })).toHaveAccessibleDescription('Tarifa da classe 1 no troço')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('radio', { name: 'Preço' })).not.toBeInTheDocument()

    // A legenda passa a mostrar as faixas de preço.
    await user.click(screen.getByRole('button', { name: 'Legenda' }))
    expect(screen.getByText('Sem portagem')).toBeInTheDocument()
    expect(screen.getByText('3 € ou mais')).toBeInTheDocument()
  })

  it('a legenda começa recolhida e abre e fecha', async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole('button', { name: 'Legenda' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Pórtico inativo')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Pórtico inativo')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByText('Pórtico inativo')).not.toBeInTheDocument()
  })
})
