import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'

// O jsdom não tem WebGL: a cena 3D é substituída; tudo o resto (store, rótulos, painéis) é real.
vi.mock('../components/scene3d/webgl.ts', () => ({ isWebGLAvailable: () => true }))
vi.mock('../components/scene3d/MapScene.tsx', () => ({ default: () => <div data-testid="map-scene" /> }))

beforeEach(() => {
  // Dá ao viewport um tamanho, para a vista e os rótulos existirem.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 700))
})

afterEach(() => {
  vi.restoreAllMocks()
})

const renderApp = () => render(<App mapStoreOptions={{ animate: false }} />)

describe('App (layout principal)', () => {
  it('apresenta barra superior, mapa, painel lateral e controlos', async () => {
    renderApp()

    expect(screen.getByRole('banner')).toHaveTextContent('TollLab')
    expect(screen.getByRole('main', { name: 'Mapa da rede' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'Mapa interativo da rede' })).toBeInTheDocument()
    expect(await screen.findByTestId('map-scene')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Painel lateral' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Controlos da simulação' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Navegação do mapa' })).toBeInTheDocument()
  })

  it('identifica o mapa como esquemático e não mostra números inventados', () => {
    renderApp()

    expect(screen.getByText(/Cidades em posições reais/)).toHaveTextContent('não é cartografia oficial')
    // Tráfego e receita ficam vazios até haver simulação.
    expect(screen.getAllByText('Sem dados')).toHaveLength(2)
  })

  it('mostra as contagens reais da rede carregada', () => {
    renderApp()

    const activeTolls = screen.getByText('Portagens ativas').closest('div')
    expect(activeTolls).toHaveTextContent('5')
    expect(activeTolls).toHaveTextContent('de 6 pórticos')
  })

  it('abre e fecha o painel lateral, tirando-o da navegação quando fechado', async () => {
    const user = userEvent.setup()
    renderApp()

    const toggle = screen.getByRole('button', { name: 'Fechar painel lateral' })
    const panel = screen.getByRole('complementary', { name: 'Painel lateral' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-controls', panel.id)

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Abrir painel lateral' })).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('inert')

    await user.click(screen.getByRole('button', { name: 'Abrir painel lateral' }))
    expect(panel).not.toHaveAttribute('inert')
  })

  it('marca as ações ainda sem modelo como indisponíveis mas focáveis, com o motivo', async () => {
    const user = userEvent.setup()
    renderApp()

    const save = screen.getByRole('button', { name: 'Guardar cenário' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).not.toBeDisabled()
    expect(save).toHaveAccessibleDescription(/cenários ainda não estão disponíveis/)
    expect(screen.getByRole('button', { name: 'Repor configuração' })).toHaveAccessibleDescription(/não há alterações/)

    save.focus()
    await user.keyboard('{Enter}')
    expect(save).toHaveFocus()
  })

  it('permite chegar ao mapa e aos seus controlos só com o teclado', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar painel lateral' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('application', { name: 'Mapa interativo da rede' })).toHaveFocus()
    // A seguir vêm os rótulos das cidades, que são botões.
    await user.tab()
    expect(document.activeElement).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('button', { pressed: false })).toContain(document.activeElement)
  })
})

describe('seleção no mapa e painel lateral', () => {
  it('seleciona uma cidade pelo rótulo e mostra as suas ligações', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Porto' }))

    expect(screen.getByRole('button', { name: 'Porto' })).toHaveAttribute('aria-pressed', 'true')
    const panel = screen.getByRole('complementary', { name: 'Painel lateral' })
    expect(within(panel).getByRole('heading', { name: 'Porto' })).toBeInTheDocument()
    expect(within(panel).getByText('Ligações (6)')).toBeInTheDocument()
  })

  it('navega de uma cidade para um troço e volta à visão geral', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Porto' }))
    const panel = screen.getByRole('complementary', { name: 'Painel lateral' })
    await user.click(within(panel).getByRole('button', { name: /A4.*Penafiel/ }))

    expect(within(panel).getByRole('heading', { name: 'Porto – Penafiel' })).toBeInTheDocument()
    expect(within(panel).getByText('Autoestrada · dois sentidos')).toBeInTheDocument()
    expect(within(panel).getByText('Pórtico A4 Porto – Penafiel')).toBeInTheDocument()
    expect(within(panel).getByText('Desconhecido')).toBeInTheDocument()
    // O rótulo do Porto deixa de estar selecionado: a seleção é única.
    expect(screen.getByRole('button', { name: 'Porto' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(within(panel).getByRole('button', { name: 'Voltar à visão geral' }))
    expect(within(panel).getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })

  it('Escape no mapa limpa a seleção', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Braga' }))
    screen.getByRole('application', { name: 'Mapa interativo da rede' }).focus()
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Braga' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })

  it('esconder as vias alternativas limpa uma seleção que deixou de estar visível', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Porto' }))
    const panel = screen.getByRole('complementary', { name: 'Painel lateral' })
    await user.click(within(panel).getByRole('button', { name: /N15.*Penafiel/ }))
    expect(within(panel).getByText('Via alternativa · dois sentidos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Camadas' }))
    await user.click(screen.getByRole('switch', { name: 'Vias alternativas' }))

    expect(within(panel).getByRole('heading', { name: 'Visão geral' })).toBeInTheDocument()
  })
})
