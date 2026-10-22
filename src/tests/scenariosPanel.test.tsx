import { render, screen, within } from '@testing-library/react'
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

async function saveAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  const field = within(panel()).getByLabelText('Nome do novo cenário')
  await user.clear(field)
  await user.type(field, name)
  await user.click(within(panel()).getByRole('button', { name: 'Guardar' }))
}

describe('painel de cenários', () => {
  it('guarda dois cenários com tarifas diferentes e compara-os', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)

    await user.click(screen.getByRole('button', { name: /Cenário atual/ }))
    expect(within(panel()).getByRole('heading', { name: 'Cenários' })).toBeInTheDocument()
    expect(within(panel()).getByText(/Ainda não há cenários/)).toBeInTheDocument()
    await saveAs(user, 'Base')
    expect(screen.getByRole('button', { name: /Cenário atual/ })).toHaveTextContent('Base')

    // Muda uma tarifa pelo painel do pórtico e guarda como segundo cenário.
    await user.click(screen.getByRole('button', { name: 'Porto' }))
    await user.click(within(panel()).getByRole('button', { name: /A4.*Penafiel/ }))
    await user.click(within(panel()).getByRole('button', { name: /Pórtico A4 Porto – Penafiel/ }))
    const field = within(panel()).getByRole('textbox', { name: /Valor exato \(Classe 1\)/ })
    await user.clear(field)
    await user.type(field, '6')
    expect(screen.getByRole('button', { name: /Cenário atual/ })).toHaveTextContent(/alterações por guardar/)

    await user.click(screen.getByRole('button', { name: /Cenário atual/ }))
    await saveAs(user, 'A4 cara')
    expect(within(panel()).getByText('Guardados (2)')).toBeInTheDocument()

    const [first, second] = within(panel()).getAllByRole('checkbox', { name: /Comparar/ })
    if (!first || !second) throw new Error('faltam caixas de comparação')
    await user.click(first)
    await user.click(second)

    const comparison = within(panel()).getByRole('table')
    expect(within(panel()).getByText(/Comparação: A “Base” → B “A4 cara”/)).toBeInTheDocument()
    expect(within(panel()).getByText('1 pórtico difere entre os cenários.')).toBeInTheDocument()
    expect(within(comparison).getByRole('rowheader', { name: 'Receita bruta' })).toBeInTheDocument()
    expect(within(comparison).getByRole('rowheader', { name: 'Veículos que evitam portagens' }).closest('tr')).toHaveTextContent(/\+/)
  })

  it('carregar um cenário repõe a sua configuração; editar depois não o altera', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)
    await user.click(screen.getByRole('button', { name: /Cenário atual/ }))
    await saveAs(user, 'Original')

    await user.click(screen.getByRole('button', { name: 'Porto' }))
    await user.click(within(panel()).getByRole('button', { name: /A4.*Penafiel/ }))
    await user.click(within(panel()).getByRole('button', { name: /Pórtico A4 Porto – Penafiel/ }))
    await user.click(within(panel()).getByRole('switch', { name: 'Cobrança ativa' }))

    await user.click(screen.getByRole('button', { name: /Cenário atual/ }))
    await user.click(within(panel()).getByRole('button', { name: 'Carregar' }))
    expect(within(panel()).getByText('Guardada')).toBeInTheDocument()

    await user.click(within(panel()).getByRole('button', { name: 'Voltar ao mapa' }))
    expect(screen.getByText('Portagens ativas').closest('div')).toHaveTextContent('5')
  })

  it('a semente aceita só inteiros e mostra o erro', async () => {
    const user = userEvent.setup()
    render(<App mapStoreOptions={{ animate: false }} />)
    await user.click(screen.getByRole('button', { name: /Cenário atual/ }))

    const seed = within(panel()).getByRole('textbox', { name: 'Semente da simulação' })
    await user.clear(seed)
    await user.type(seed, '12a')
    expect(seed).toHaveAttribute('aria-invalid', 'true')
    await user.clear(seed)
    await user.type(seed, '77')
    await user.tab()
    expect(seed).toHaveValue('77')
    await user.click(within(panel()).getByRole('button', { name: 'Voltar ao mapa' }))
    expect(screen.getByText(/semente 77/)).toBeInTheDocument()
  })
})
