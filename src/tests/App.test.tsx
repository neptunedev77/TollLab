import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'

describe('App (layout principal)', () => {
  it('apresenta barra superior, mapa, painel lateral e controlos de simulação', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toHaveTextContent('TollLab')
    expect(screen.getByRole('main', { name: 'Mapa da rede' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Painel lateral' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Controlos da simulação' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Navegação do mapa' })).toBeInTheDocument()
  })

  it('identifica o mapa como esquemático e não mostra números inventados', () => {
    render(<App />)

    expect(screen.getByText(/Mapa esquemático/)).toHaveTextContent('não cartográfico')
    expect(screen.getByText('A rede ainda não foi carregada')).toBeInTheDocument()
    // As três métricas da visão geral ficam vazias até existir modelo.
    expect(screen.getAllByText('Sem dados')).toHaveLength(3)
  })

  it('abre e fecha o painel lateral, tirando-o da navegação quando fechado', async () => {
    const user = userEvent.setup()
    render(<App />)

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

  it('marca as ações sem modelo como indisponíveis mas focáveis, com o motivo', async () => {
    const user = userEvent.setup()
    render(<App />)

    const add = screen.getByRole('button', { name: 'Adicionar portagem' })
    expect(add).toHaveAttribute('aria-disabled', 'true')
    expect(add).not.toBeDisabled()
    expect(add).toHaveAccessibleDescription(/Disponível quando a rede estiver carregada/)

    add.focus()
    expect(add).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(add).toHaveFocus()
  })

  it('permite chegar aos controlos essenciais só com o teclado', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Fechar painel lateral' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Aproximar' })).toHaveFocus()
  })
})
