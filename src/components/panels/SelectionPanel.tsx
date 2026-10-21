import type { NetworkLoadResult } from '../../data/loadNetwork.ts'
import { useMapStore } from '../../store/useMapStore.ts'
import { EdgePanel } from './EdgePanel.tsx'
import { NodePanel } from './NodePanel.tsx'
import { OverviewPanel } from './OverviewPanel.tsx'
import { TollPanel } from './TollPanel.tsx'

/** Conteúdo do painel lateral segundo a seleção atual do mapa. */
export function SelectionPanel({ networkLoad }: { networkLoad: NetworkLoadResult }) {
  const selection = useMapStore((state) => state.selection)
  const dataset = useMapStore((state) => state.dataset)
  const tolls = useMapStore((state) => state.tolls)
  const beginPlacement = useMapStore((state) => state.beginPlacement)
  const resetTolls = useMapStore((state) => state.resetTolls)

  if (selection?.kind === 'toll') {
    const toll = tolls.find((candidate) => candidate.id === selection.id)
    if (toll) return <TollPanel key={toll.id} toll={toll} />
  }
  if (selection?.kind === 'edge') {
    const edge = dataset.network.edges.find((candidate) => candidate.id === selection.id)
    if (edge) return <EdgePanel key={edge.id} edge={edge} />
  }
  if (selection?.kind === 'node') {
    const node = dataset.network.nodes.find((candidate) => candidate.id === selection.id)
    if (node) return <NodePanel key={node.id} node={node} />
  }
  return (
    <OverviewPanel
      networkLoad={networkLoad}
      editing={{ tolls, modified: tolls !== dataset.tolls, onAddToll: beginPlacement, onReset: resetTolls }}
    />
  )
}
