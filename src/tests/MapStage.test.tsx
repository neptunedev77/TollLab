import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapStage } from '../components/map/MapStage.tsx'
import { loadNetwork } from '../data/loadNetwork.ts'
import { edge, triangleDataset } from './fixtures.ts'

describe('MapStage', () => {
  it('mostra um estado de erro compreensível quando a rede é inválida', () => {
    const dataset = triangleDataset()
    const broken = { ...dataset, network: { ...dataset.network, edges: [...dataset.network.edges, edge('ax', 'a', 'x')] } }

    render(<MapStage networkLoad={loadNetwork(broken)} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('A rede de demonstração tem dados inválidos')
    expect(alert).toHaveTextContent('1 problema encontrado')
    expect(alert).toHaveTextContent('nó inexistente "x"')
  })
})
