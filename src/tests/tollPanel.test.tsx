import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'

vi.mock('../components/scene3d/webgl.ts', () => ({ isWebGLAvailable: () => true }))
vi.mock('../components/scene3d/MapScene.tsx', () => ({ default: () => <div data-testid="map-scene" /> }))

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 700))
})
afterEach(() => vi.restoreAllMocks())

const panel = () => screen.getByRole('complementary', { name: 'Painel lateral' })

/** Abre o painel do pórtico da A4 Porto – Penafiel através da navegação do painel. */
async function openPenafielToll(user: ReturnType<typeof userEvent.setup>) {
  render(<App mapStoreOptions={{ animate: false }} />)
  await user.click(screen.getByRole('button', { name: 'Porto' }))
  await user.click(within(panel()).getByRole('button', { name: /A4.*Penafiel/ }))
  await user.click(within(panel()).getByRole('button', { name: /Pórtico A4 Porto – Penafiel/ }))
  expect(within(panel()).getByRole('heading', { name: 'Pórtico A4 Porto – Penafiel' })).toBeInTheDocument()
}

describe('painel do pórtico ↔ store', () => {
  it('edita a tarifa pelo campo em euros, com vírgula decimal', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    const field = within(panel()).getByRole('textbox', { name: /Valor exato \(Classe 1\)/ })
    await user.clear(field)
    await user.type(field, '2,35')
    expect(within(panel()).getByText(/C1: 2,35/)).toBeInTheDocument()
    expect(within(panel()).getByRole('slider', { name: /Tarifa \(Classe 1\)/ })).toHaveValue('235')
  })

  it('mostra um erro compreensível para valores inválidos e não altera o modelo', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    const field = within(panel()).getByRole('textbox', { name: /Valor exato/ })
    await user.clear(field)
    await user.type(field, '-1')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('A tarifa não pode ser negativa.')
    expect(within(panel()).getByText(/C1: 2,10/)).toBeInTheDocument()

    // Ao sair do campo, o valor inválido é descartado e o campo volta a mostrar o modelo.
    await user.tab()
    expect(field).toHaveValue('2,10')
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('edita a tarifa de outra classe sem mexer na classe 1', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    await user.click(within(panel()).getByRole('radio', { name: 'Classe 3' }))
    const field = within(panel()).getByRole('textbox', { name: /Valor exato \(Classe 3\)/ })
    await user.clear(field)
    await user.type(field, '7')
    expect(within(panel()).getByText(/C1: 2,10 € · C2: 3,68 € · C3: 7,00 €/)).toBeInTheDocument()
  })

  it('desativar a cobrança atualiza o painel e a contagem de portagens ativas', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    await user.click(within(panel()).getByRole('switch', { name: 'Cobrança ativa' }))
    expect(within(panel()).getByText('Inativo')).toBeInTheDocument()

    await user.click(within(panel()).getByRole('button', { name: 'Voltar à visão geral' }))
    expect(screen.getByText('Portagens ativas').closest('div')).toHaveTextContent('4')
  })

  it('remover mostra "Anular", que repõe o pórtico', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    await user.click(within(panel()).getByRole('button', { name: 'Remover pórtico' }))
    expect(within(panel()).getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.getByText('Portagens ativas').closest('div')).toHaveTextContent('de 5 pórticos')

    await user.click(screen.getByRole('button', { name: 'Anular' }))
    expect(screen.getByText('Portagens ativas').closest('div')).toHaveTextContent('de 6 pórticos')
  })

  it('Ctrl+Z anula a última alteração fora dos campos de texto', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    await user.click(within(panel()).getByRole('switch', { name: 'Cobrança ativa' }))
    expect(within(panel()).getByText('Inativo')).toBeInTheDocument()
    await user.keyboard('{Control>}z{/Control}')
    expect(within(panel()).getByText('Ativo')).toBeInTheDocument()
  })

  it('adiciona um pórtico a partir do painel do troço e abre o seu painel', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)
    await user.click(screen.getByRole('button', { name: 'Porto' }))
    await user.click(within(panel()).getByRole('button', { name: /N15.*Penafiel/ }))
    expect(within(panel()).getByText('Sem portagens neste troço.')).toBeInTheDocument()

    await user.click(within(panel()).getByRole('button', { name: 'Adicionar portagem neste troço' }))
    expect(within(panel()).getByRole('heading', { name: 'Pórtico N15 Porto – Penafiel' })).toBeInTheDocument()
    expect(screen.getByText('Pórtico adicionado ao troço N15.')).toBeInTheDocument()
  })

  it('"Adicionar portagem" entra no modo de colocação, que Esc cancela', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)

    await user.click(screen.getByRole('button', { name: 'Adicionar portagem' }))
    expect(screen.getByText('Clica numa estrada para colocar o pórtico')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Clica numa estrada para colocar o pórtico')).not.toBeInTheDocument()
  })

  it('mover pelo slider de posição atualiza a posição no troço', async () => {
    const user = userEvent.setup()
    await openPenafielToll(user)

    const position = within(panel()).getByRole('slider', { name: /Posição no troço/ })
    expect(position).toHaveValue('50')
    // O user-event não simula as setas em <input type="range"> no jsdom; o evento change é o mesmo.
    fireEvent.change(position, { target: { value: '62' } })
    expect(position).toHaveAttribute('aria-valuetext', '62 %')

    await user.click(within(panel()).getByRole('button', { name: /No troço/ }))
    expect(within(panel()).getByText(/62 % do troço/)).toBeInTheDocument()
  })
})
