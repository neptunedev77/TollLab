import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../components/ui/Button.tsx'
import { ErrorBoundary } from '../components/ui/ErrorBoundary.tsx'
import { NumberField } from '../components/ui/NumberField.tsx'
import { Slider } from '../components/ui/Slider.tsx'

describe('Button', () => {
  it('executa a ação quando disponível', async () => {
    const onClick = vi.fn<() => void>()
    render(<Button onClick={onClick}>Guardar</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('não executa a ação quando indisponível', async () => {
    const onClick = vi.fn<() => void>()
    render(
      <Button onClick={onClick} unavailableReason="Sem rede">
        Guardar
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Tooltip', () => {
  it('abre com foco e fecha com Escape', async () => {
    const user = userEvent.setup()
    render(<Button unavailableReason="Motivo da indisponibilidade">Ação</Button>)
    const button = screen.getByRole('button', { name: 'Ação' })

    // A descrição acessível existe sempre; o balão visual só aparece quando aberto.
    expect(button).toHaveAccessibleDescription('Motivo da indisponibilidade')
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Motivo da indisponibilidade')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument()
  })
})

describe('NumberField', () => {
  it('liga a mensagem de erro ao campo para leitores de ecrã', () => {
    render(<NumberField label="Tarifa" value="-1" onChange={() => undefined} error="A tarifa não pode ser negativa." />)
    const input = screen.getByLabelText('Tarifa')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('A tarifa não pode ser negativa.')
  })

  it('reporta o texto escrito sem o converter', async () => {
    const onChange = vi.fn<(value: string) => void>()
    render(<NumberField label="Tarifa" value="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Tarifa'), '2')
    expect(onChange).toHaveBeenLastCalledWith('2')
  })
})

describe('Slider', () => {
  it('mostra o valor formatado e reage a alterações', () => {
    function Harness() {
      const [value, setValue] = useState(1)
      return <Slider label="Tarifa" min={0} max={5} step={0.5} value={value} onChange={setValue} formatValue={(v) => `${v} €`} />
    }
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Tarifa' })
    expect(slider).toHaveAttribute('aria-valuetext', '1 €')

    fireEvent.change(slider, { target: { value: '2.5' } })
    expect(slider).toHaveAttribute('aria-valuetext', '2.5 €')
  })
})

describe('ErrorBoundary', () => {
  it('mostra um estado de erro e recupera ao tentar novamente', async () => {
    // O React regista o erro capturado na consola; silenciar só neste teste.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let shouldThrow = true
    function Fragile() {
      if (shouldThrow) throw new Error('falha de teste')
      return <p>Recuperado</p>
    }

    render(
      <ErrorBoundary title="Área indisponível">
        <Fragile />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Área indisponível')
    expect(screen.getByRole('alert')).toHaveTextContent('falha de teste')

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByText('Recuperado')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
