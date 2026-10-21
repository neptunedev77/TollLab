import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Shape, type OrthographicCamera } from 'three'
import { edgeCurve, layoutBounds, pointAlong } from '../../domain/geometry.ts'
import type { NetworkDataset, RoadEdge, RoadNode, SchematicPoint, TollPoint } from '../../domain/types.ts'
import type { MapStore, Selection } from '../../store/mapStore.ts'
import { useMapStore, useMapStoreApi } from '../../store/useMapStore.ts'
import { TILT_RAD } from '../map/viewMath.ts'
import { ROAD_WIDTH, SCENE_COLORS } from './palette.ts'
import { buildRibbon } from './ribbon.ts'

/** Arrastos maiores do que isto (px) contam como pan, não como clique. */
const CLICK_TOLERANCE_PX = 5
const CAMERA_DISTANCE = 2000

interface MapSceneProps {
  /** Distância do último arrasto no viewport, para distinguir pan de clique no vazio. */
  dragDistanceRef: RefObject<number>
}

/**
 * Cena WebGL do mapa. Renderiza só quando algo muda (`frameloop="demand"`). A câmara segue a vista
 * do store através da mesma matemática usada pelos rótulos DOM, por isso nunca se desalinham.
 */
export default function MapScene({ dragDistanceRef }: MapSceneProps) {
  const store = useMapStoreApi()
  return (
    <Canvas
      orthographic
      // Sem tone mapping: as cores da cena ficam iguais aos tokens CSS da interface.
      flat
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ near: 1, far: CAMERA_DISTANCE * 3, position: [0, CAMERA_DISTANCE, 0], zoom: 1 }}
      onPointerMissed={() => {
        if ((dragDistanceRef.current ?? 0) <= CLICK_TOLERANCE_PX) store.getState().clearSelection()
      }}
      aria-hidden="true"
    >
      <CameraRig store={store} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-300, 900, -200]} intensity={1.4} />
      <SceneContent />
    </Canvas>
  )
}

function CameraRig({ store }: { store: MapStore }) {
  const get = useThree((state) => state.get)

  useEffect(() => {
    const apply = () => {
      const { view } = store.getState()
      if (!view) return
      const { camera, invalidate } = get()
      if (!(camera as OrthographicCamera).isOrthographicCamera) return
      camera.zoom = view.zoom
      camera.position.set(
        view.centerX,
        CAMERA_DISTANCE * Math.cos(TILT_RAD),
        view.centerY + CAMERA_DISTANCE * Math.sin(TILT_RAD),
      )
      camera.lookAt(view.centerX, 0, view.centerY)
      camera.updateProjectionMatrix()
      invalidate()
    }
    apply()
    return store.subscribe((state, previous) => {
      if (state.view !== previous.view) apply()
    })
  }, [get, store])

  return null
}

function SceneContent() {
  const dataset = useMapStore((state) => state.dataset)
  const layers = useMapStore((state) => state.layers)
  const selection = useMapStore((state) => state.selection)
  const select = useMapStore((state) => state.select)
  const [hover, setHover] = useState<Selection | null>(null)

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hover])

  const curves = useMemo(() => {
    const map = new Map<string, readonly SchematicPoint[]>()
    for (const edge of dataset.network.edges) {
      const curve = edgeCurve(dataset, edge.id)
      if (curve) map.set(edge.id, curve)
    }
    return map
  }, [dataset])

  const visibleEdges = dataset.network.edges.filter((edge) => edge.roadClass === 'motorway' || layers.alternatives)
  // Vias alternativas por baixo das autoestradas.
  const ordered = [...visibleEdges].sort((a, b) => (a.roadClass === b.roadClass ? 0 : a.roadClass === 'alternative' ? -1 : 1))

  const isSelected = (kind: Selection['kind'], id: string) => selection?.kind === kind && selection.id === id
  const isHovered = (kind: Selection['kind'], id: string) => hover?.kind === kind && hover.id === id

  const handlers = (target: Selection): Handlers => ({
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (event.delta <= CLICK_TOLERANCE_PX) select(target)
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setHover(target)
    },
    onPointerOut: () => setHover((current) => (current?.id === target.id ? null : current)),
  })

  return (
    <>
      <Board dataset={dataset} />
      {ordered.map((edge) => {
        const curve = curves.get(edge.id)
        if (!curve) return null
        return (
          <Road
            key={edge.id}
            edge={edge}
            curve={curve}
            selected={isSelected('edge', edge.id)}
            hovered={isHovered('edge', edge.id)}
            handlers={handlers({ kind: 'edge', id: edge.id })}
          />
        )
      })}
      {layers.tolls &&
        dataset.tolls.map((toll) => {
          const edge = visibleEdges.find((candidate) => candidate.id === toll.edgeId)
          const curve = curves.get(toll.edgeId)
          return edge && curve ? <Gantry key={toll.id} toll={toll} edge={edge} curve={curve} /> : null
        })}
      {dataset.network.nodes.map((node) => {
        const position = dataset.layout.nodePositions[node.id]
        if (!position) return null
        return (
          <NodeMarker
            key={node.id}
            node={node}
            position={position}
            selected={isSelected('node', node.id)}
            hovered={isHovered('node', node.id)}
            handlers={handlers({ kind: 'node', id: node.id })}
          />
        )
      })}
    </>
  )
}

interface Handlers {
  onClick: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut: () => void
}

function useRibbon(curve: readonly SchematicPoint[], width: number, elevation: number) {
  const geometry = useMemo(() => {
    const { positions, indices } = buildRibbon(curve, width, elevation)
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    result.setIndex(new BufferAttribute(indices, 1))
    result.computeBoundingSphere()
    return result
  }, [curve, width, elevation])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Road({
  edge,
  curve,
  selected,
  hovered,
  handlers,
}: {
  edge: RoadEdge
  curve: readonly SchematicPoint[]
  selected: boolean
  hovered: boolean
  handlers: Handlers
}) {
  const motorway = edge.roadClass === 'motorway'
  const widths = motorway ? ROAD_WIDTH.motorway : ROAD_WIDTH.alternative
  const base = motorway ? 0.6 : 0.3
  const casing = useRibbon(curve, widths.casing, base)
  const fill = useRibbon(curve, widths.fill, base + 0.1)
  const glow = useRibbon(curve, ROAD_WIDTH.glow, 0.05)
  const hit = useRibbon(curve, ROAD_WIDTH.hit, 2)

  const fillColor = selected
    ? SCENE_COLORS.selected
    : hovered
      ? SCENE_COLORS.hover
      : motorway
        ? SCENE_COLORS.motorway
        : SCENE_COLORS.alternative

  return (
    <group>
      {selected && (
        <mesh geometry={glow} renderOrder={1}>
          <meshBasicMaterial color={SCENE_COLORS.selectedGlow} transparent opacity={0.22} side={DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <mesh geometry={casing}>
        <meshBasicMaterial color={motorway ? SCENE_COLORS.motorwayCasing : SCENE_COLORS.alternativeCasing} side={DoubleSide} />
      </mesh>
      <mesh geometry={fill}>
        <meshBasicMaterial color={fillColor} side={DoubleSide} />
      </mesh>
      <mesh geometry={hit} {...handlers}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function NodeMarker({
  node,
  position,
  selected,
  hovered,
  handlers,
}: {
  node: RoadNode
  position: SchematicPoint
  selected: boolean
  hovered: boolean
  handlers: Handlers
}) {
  const city = node.kind === 'city'
  const radius = city ? 9 : 6
  const scale = selected ? 1.25 : hovered ? 1.12 : 1
  const ring = selected ? SCENE_COLORS.selected : city ? SCENE_COLORS.cityRing : SCENE_COLORS.interchangeRing

  return (
    <group position={[position.x, 0, position.y]} scale={[scale, 1, scale]} {...handlers}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[radius, radius, 2.4, 40]} />
        <meshLambertMaterial color={ring} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.4, 40]} />
        <meshBasicMaterial color={city ? SCENE_COLORS.cityFill : SCENE_COLORS.interchangeFill} />
      </mesh>
    </group>
  )
}

/** Pórtico 3D simples: dois postes e uma travessa, perpendicular à estrada. */
function Gantry({ toll, edge, curve }: { toll: TollPoint; edge: RoadEdge; curve: readonly SchematicPoint[] }) {
  const anchor = pointAlong(curve, toll.position)
  if (!anchor) return null
  const color = toll.active ? SCENE_COLORS.tollActive : SCENE_COLORS.tollInactive
  const half = (edge.roadClass === 'motorway' ? ROAD_WIDTH.motorway.casing : ROAD_WIDTH.alternative.casing) / 2 + 2.5
  const height = 9
  const angle = Math.atan2(-anchor.tangent.y, anchor.tangent.x)

  return (
    <group position={[anchor.point.x, 0, anchor.point.y]} rotation={[0, angle, 0]}>
      {[-half, half].map((z) => (
        <mesh key={z} position={[0, height / 2, z]}>
          <boxGeometry args={[1.8, height, 1.8]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[2.4, 2.2, half * 2 + 1.8]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  )
}

/** Tabuleiro arredondado por baixo da rede, para a dar um ar de "mesa de trabalho". */
function Board({ dataset }: { dataset: NetworkDataset }) {
  const shape = useMemo(() => {
    const bounds = layoutBounds(dataset)
    const margin = 70
    const radius = 60
    const x0 = bounds.minX - margin
    const y0 = bounds.minY - margin
    const x1 = bounds.maxX + margin
    const y1 = bounds.maxY + margin
    const result = new Shape()
    result.moveTo(x0 + radius, y0)
    result.lineTo(x1 - radius, y0)
    result.quadraticCurveTo(x1, y0, x1, y0 + radius)
    result.lineTo(x1, y1 - radius)
    result.quadraticCurveTo(x1, y1, x1 - radius, y1)
    result.lineTo(x0 + radius, y1)
    result.quadraticCurveTo(x0, y1, x0, y1 - radius)
    result.lineTo(x0, y0 + radius)
    result.quadraticCurveTo(x0, y0, x0 + radius, y0)
    return result
  }, [dataset])

  // A forma é desenhada no plano XY. Rodar +90° em X leva (x, y, z) → (x, −z, y): o y do esquema
  // passa a z no chão e o z local passa a profundidade (abaixo das estradas).
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* "Lábio" inferior do tabuleiro, ligeiramente deslocado para baixo e para a direita. */}
      <mesh position={[4, 7, 0.8]}>
        <shapeGeometry args={[shape, 24]} />
        <meshBasicMaterial color={SCENE_COLORS.boardEdge} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.5]}>
        <shapeGeometry args={[shape, 24]} />
        <meshBasicMaterial color={SCENE_COLORS.board} side={DoubleSide} />
      </mesh>
    </group>
  )
}
