import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { clockLabel } from '../utils/format.ts'

vi.mock('../components/scene3d/webgl.ts', () => ({ isWebGLAvailable: () => true }))
vi.mock('../components/scene3d/MapScene.tsx', () => ({ default: () => <div data-testid="map-scene" /> }))

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 700))
})
afterEach(() => vi.restoreAllMocks())

const dock = () => screen.getByRole('toolbar', { name: 'Controlos da simulação' })

describe('controlos da simulação', () => {
  it('inicia, pausa e reinicia; o estado e o botão principal acompanham', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)

    expect(within(dock()).getByText('Simulação parada')).toBeInTheDocument()
    expect(within(dock()).getByRole('button', { name: 'Reiniciar simulação' })).toHaveAttribute('aria-disabled', 'true')

    await user.click(within(dock()).getByRole('button', { name: 'Iniciar simulação' }))
    expect(within(dock()).getByText('Em curso')).toBeInTheDocument()

    await user.click(within(dock()).getByRole('button', { name: 'Pausar simulação' }))
    expect(within(dock()).getByText('Em pausa')).toBeInTheDocument()

    await user.click(within(dock()).getByRole('button', { name: 'Reiniciar simulação' }))
    expect(within(dock()).getByText('Simulação parada')).toBeInTheDocument()
    expect(within(dock()).getByLabelText('Hora simulada')).toHaveTextContent('08:00')
  })

  it('muda de velocidade entre 1x, 2x e 4x', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)

    expect(within(dock()).getByRole('button', { name: 'Velocidade 1x' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dock()).getByRole('button', { name: 'Velocidade 4x' }))
    expect(within(dock()).getByRole('button', { name: 'Velocidade 4x' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dock()).getByRole('button', { name: 'Velocidade 1x' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('mostra quantos veículos cada veículo desenhado representa', () => {
    render(<App mapStoreOptions={{ animate: false }} />)
    expect(within(dock()).getByText(/Cada veículo desenhado representa 4 veículos simulados/)).toBeInTheDocument()
  })
})

describe('clockLabel', () => {
  it('converte minutos simulados numa hora do dia', () => {
    expect(clockLabel(0, 8)).toBe('08:00')
    expect(clockLabel(72.9, 8)).toBe('09:12')
    expect(clockLabel(60 * 17, 8)).toBe('01:00')
  })
})
