import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Shape, Vector2, type OrthographicCamera } from 'three'
import { PORTUGAL_MAINLAND, SPAIN_CLIPPED } from '../../data/geo/basemap.ts'
import { project } from '../../data/geo/projection.ts'
import { edgeCurve, pointAlong, projectOntoPolyline } from '../../domain/geometry.ts'
import { snapToNetwork } from '../../domain/tolls.ts'
import type { EdgeId, RoadEdge, RoadNode, SchematicPoint, TollPoint } from '../../domain/types.ts'
import { edgeLoad } from '../../simulation/assignment.ts'
import type { MapStore, Selection } from '../../store/mapStore.ts'
import { tollTableByEdge } from '../../simulation/costs.ts'
import { useAssignment, useCharging } from '../../store/useAssignment.ts'
import { useMapStore, useMapStoreApi } from '../../store/useMapStore.ts'
import { screenToWorld, TILT_RAD } from '../map/viewMath.ts'
import { bandColor, COLOR_SCALES, NODE_RADIUS, ROAD_WIDTH, SCENE_COLORS } from './palette.ts'
import { buildRibbon } from './ribbon.ts'
import { GantryPulse, Vehicles } from './Vehicles.tsx'

/** Arrastos maiores do que isto (px) contam como pan, não como clique. */
const CLICK_TOLERANCE_PX = 5
/** Distância máxima (px no ecrã) para um pórtico arrastado encaixar numa estrada. */
const SNAP_RADIUS_PX = 36
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
        const state = store.getState()
        if ((dragDistanceRef.current ?? 0) <= CLICK_TOLERANCE_PX && state.mode.kind === 'idle') state.clearSelection()
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

interface Handlers {
  onClick: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut: () => void
}

function SceneContent() {
  const store = useMapStoreApi()
  const dataset = useMapStore((state) => state.dataset)
  const tolls = useMapStore((state) => state.tolls)
  const layers = useMapStore((state) => state.layers)
  const selection = useMapStore((state) => state.selection)
  const hover = useMapStore((state) => state.hover)
  const placing = useMapStore((state) => state.mode.kind === 'placing')
  const draggingId = useMapStore((state) => state.drag?.tollId ?? null)
  const assignment = useAssignment()
  const charging = useCharging()
  const coloring = useMapStore((state) => state.coloring)
  const priceTable = useMemo(() => tollTableByEdge(tolls), [tolls])

  /** Cor da estrada segundo o modo escolhido; `null` usa as cores da classe da via. */
  const colorFor = (edgeId: EdgeId): string | null => {
    if (coloring === 'traffic' && assignment) return bandColor(COLOR_SCALES.traffic, edgeLoad(assignment, edgeId))
    if (coloring === 'price') return bandColor(COLOR_SCALES.price, priceTable.get(edgeId)?.c1 ?? 0)
    if (coloring === 'revenue' && charging) return bandColor(COLOR_SCALES.revenue, charging.report.byEdge.get(edgeId) ?? 0)
    return null
  }
  const [ghostState, setGhost] = useState<{ edgeId: EdgeId; position: number } | null>(null)
  // O fantasma só existe em modo de colocação (derivado, sem efeito para o limpar).
  const ghost = placing ? ghostState : null

  const curves = useMemo(() => {
    const map = new Map<string, readonly SchematicPoint[]>()
    for (const edge of dataset.network.edges) {
      const curve = edgeCurve(dataset, edge.id)
      if (curve) map.set(edge.id, curve)
    }
    return map
  }, [dataset])

  const visibleEdges = dataset.network.edges.filter((edge) => edge.roadClass === 'motorway' || layers.alternatives)
  const visibleEdgeIds = new Set(visibleEdges.map((edge) => edge.id))
  // Vias alternativas por baixo das autoestradas.
  const ordered = [...visibleEdges].sort((a, b) => (a.roadClass === b.roadClass ? 0 : a.roadClass === 'alternative' ? -1 : 1))

  const is = (target: Selection | null, kind: Selection['kind'], id: string) => target?.kind === kind && target.id === id

  const handlers = (target: Selection): Handlers => ({
    onClick: (event) => {
      event.stopPropagation()
      if (event.delta > CLICK_TOLERANCE_PX) return
      store.getState().select(target)
    },
    onPointerOver: (event) => {
      event.stopPropagation()
      store.getState().setHover(target)
    },
    onPointerOut: () => {
      if (is(store.getState().hover, target.kind, target.id)) store.getState().setHover(null)
    },
  })

  /** Em modo de colocação, a estrada sob o cursor recebe o pórtico no ponto clicado. */
  const roadHandlers = (edge: RoadEdge, curve: readonly SchematicPoint[]): Handlers & {
    onPointerMove: (event: ThreeEvent<PointerEvent>) => void
  } => {
    const base = handlers({ kind: 'edge', id: edge.id })
    const positionAt = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
      projectOntoPolyline(curve, { x: event.point.x, y: event.point.z })?.t ?? 0.5
    return {
      ...base,
      onClick: (event) => {
        if (store.getState().mode.kind !== 'placing') return base.onClick(event)
        event.stopPropagation()
        if (event.delta > CLICK_TOLERANCE_PX) return
        setGhost(null)
        store.getState().addToll(edge.id, positionAt(event))
      },
      onPointerMove: (event) => {
        if (store.getState().mode.kind !== 'placing') return
        event.stopPropagation()
        setGhost({ edgeId: edge.id, position: positionAt(event) })
      },
      onPointerOut: () => {
        base.onPointerOut()
        setGhost((current) => (current?.edgeId === edge.id ? null : current))
      },
    }
  }

  return (
    <>
      <Basemap />
      {ordered.map((edge) => {
        const curve = curves.get(edge.id)
        if (!curve) return null
        return (
          <Road
            key={edge.id}
            edge={edge}
            curve={curve}
            selected={is(selection, 'edge', edge.id)}
            hovered={is(hover, 'edge', edge.id)}
            dataColor={colorFor(edge.id)}
            handlers={roadHandlers(edge, curve)}
          />
        )
      })}
      {layers.tolls &&
        tolls.map((toll) => {
          const edge = visibleEdgeIds.has(toll.edgeId) ? dataset.network.edges.find((e) => e.id === toll.edgeId) : undefined
          const curve = curves.get(toll.edgeId)
          if (!edge || !curve) return null
          return (
            <Gantry
              key={toll.id}
              toll={toll}
              edge={edge}
              curve={curve}
              selected={is(selection, 'toll', toll.id)}
              hovered={is(hover, 'toll', toll.id)}
              dragging={draggingId === toll.id}
              interactive={!placing}
              handlers={handlers({ kind: 'toll', id: toll.id })}
            />
          )
        })}
      {ghost &&
        (() => {
          const edge = dataset.network.edges.find((candidate) => candidate.id === ghost.edgeId)
          const curve = curves.get(ghost.edgeId)
          return edge && curve ? <GantryShape edge={edge} curve={curve} position={ghost.position} color={SCENE_COLORS.selected} opacity={0.55} /> : null
        })()}
      <Vehicles />
      {dataset.network.nodes.map((node) => {
        const position = dataset.layout.nodePositions[node.id]
        if (!position) return null
        return (
          <NodeMarker
            key={node.id}
            node={node}
            position={position}
            selected={is(selection, 'node', node.id)}
            hovered={is(hover, 'node', node.id)}
            handlers={handlers({ kind: 'node', id: node.id })}
          />
        )
      })}
    </>
  )
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
  dataColor,
  handlers,
}: {
  edge: RoadEdge
  curve: readonly SchematicPoint[]
  selected: boolean
  hovered: boolean
  /** Cor de dados (tráfego, preço ou receita); `null` usa a cor da classe da via. */
  dataColor: string | null
  handlers: Handlers & { onPointerMove: (event: ThreeEvent<PointerEvent>) => void }
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
      : dataColor !== null
        ? dataColor
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
  const radius = city ? NODE_RADIUS.city : NODE_RADIUS.interchange
  const scale = selected ? 1.25 : hovered ? 1.12 : 1
  const ring = selected ? SCENE_COLORS.selected : city ? SCENE_COLORS.cityRing : SCENE_COLORS.interchangeRing

  return (
    <group position={[position.x, 0, position.y]} scale={[scale, 1, scale]} {...handlers}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[radius, radius, 1.8, 40]} />
        <meshLambertMaterial color={ring} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.3, 40]} />
        <meshBasicMaterial color={city ? SCENE_COLORS.cityFill : SCENE_COLORS.interchangeFill} />
      </mesh>
    </group>
  )
}

/** Geometria do pórtico: dois postes e uma travessa, perpendicular à estrada no ponto `position`. */
function GantryShape({
  edge,
  curve,
  position,
  color,
  opacity = 1,
  scale = 1,
}: {
  edge: RoadEdge
  curve: readonly SchematicPoint[]
  position: number
  color: string
  opacity?: number
  scale?: number
}) {
  const anchor = pointAlong(curve, position)
  if (!anchor) return null
  const half = (edge.roadClass === 'motorway' ? ROAD_WIDTH.motorway.casing : ROAD_WIDTH.alternative.casing) / 2 + 1.6
  const height = 5.5
  const angle = Math.atan2(-anchor.tangent.y, anchor.tangent.x)
  const material = <meshLambertMaterial color={color} transparent={opacity < 1} opacity={opacity} />

  return (
    <group position={[anchor.point.x, 0, anchor.point.y]} rotation={[0, angle, 0]} scale={scale}>
      {[-half, half].map((z) => (
        <mesh key={z} position={[0, height / 2, z]}>
          <boxGeometry args={[1.1, height, 1.1]} />
          {material}
        </mesh>
      ))}
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[1.5, 1.4, half * 2 + 1.1]} />
        {material}
      </mesh>
    </group>
  )
}

/** Pórtico interativo: clicar seleciona; arrastar move-o ao longo das estradas (Esc cancela). */
function Gantry({
  toll,
  edge,
  curve,
  selected,
  hovered,
  dragging,
  interactive,
  handlers,
}: {
  toll: TollPoint
  edge: RoadEdge
  curve: readonly SchematicPoint[]
  selected: boolean
  hovered: boolean
  dragging: boolean
  interactive: boolean
  handlers: Handlers
}) {
  const store = useMapStoreApi()
  const anchor = pointAlong(curve, toll.position)
  if (!anchor) return null

  const color = selected || dragging ? SCENE_COLORS.selected : toll.active ? SCENE_COLORS.tollActive : SCENE_COLORS.tollInactive

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || event.nativeEvent.button !== 0) return
    event.stopPropagation()
    const canvas = event.nativeEvent.target as HTMLElement
    const rect = canvas.getBoundingClientRect()
    const state = store.getState()
    state.beginTollDrag(toll.id)

    const onMove = (move: PointerEvent) => {
      const { view, viewport, layers, dataset } = store.getState()
      if (!view || !viewport) return
      const world = screenToWorld({ x: move.clientX - rect.left, y: move.clientY - rect.top }, view, viewport)
      const snap = snapToNetwork(dataset, world, SNAP_RADIUS_PX / view.zoom, (candidate) =>
        candidate.roadClass === 'motorway' || layers.alternatives,
      )
      if (snap) store.getState().dragTollTo(snap.edgeId, snap.position)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey, true)
    }
    const onUp = () => {
      cleanup()
      store.getState().endTollDrag(true)
    }
    const onKey = (key: KeyboardEvent) => {
      if (key.key !== 'Escape') return
      key.stopPropagation()
      cleanup()
      store.getState().endTollDrag(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey, true)
  }

  return (
    <group>
      <GantryPulse tollId={toll.id} x={anchor.point.x} z={anchor.point.y} />
      {(selected || dragging) && (
        <mesh position={[anchor.point.x, 0.15, anchor.point.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[9, 40]} />
          <meshBasicMaterial color={SCENE_COLORS.selectedGlow} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
      <GantryShape edge={edge} curve={curve} position={toll.position} color={color} scale={hovered || selected ? 1.15 : 1} />
      {/* Área de clique invisível, maior do que o pórtico. */}
      <mesh
        position={[anchor.point.x, 4, anchor.point.y]}
        onPointerDown={onPointerDown}
        onClick={handlers.onClick}
        onPointerOver={handlers.onPointerOver}
        onPointerOut={handlers.onPointerOut}
      >
        <boxGeometry args={[10, 9, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

const PORTUGAL_POINTS = PORTUGAL_MAINLAND.map(project)
const SPAIN_POINTS = SPAIN_CLIPPED.map(project)

function shapeFrom(points: readonly SchematicPoint[]): Shape {
  return new Shape(points.map((point) => new Vector2(point.x, point.y)))
}

function closed(points: readonly SchematicPoint[]): SchematicPoint[] {
  const first = points[0]
  return first ? [...points, first] : []
}

/**
 * Mapa base: Portugal continental e Espanha (Natural Earth) sobre o mar, com um halo suave na
 * costa e uma linha fina de costa/fronteira. O mar é o fundo CSS do contentor (canvas transparente).
 */
function Basemap() {
  const portugal = useMemo(() => shapeFrom(PORTUGAL_POINTS), [])
  const spain = useMemo(() => shapeFrom(SPAIN_POINTS), [])
  const halo = useRibbon(useMemo(() => closed(PORTUGAL_POINTS), []), 16, -1.2)
  const spainHalo = useRibbon(useMemo(() => closed(SPAIN_POINTS), []), 16, -1.2)
  const outline = useRibbon(useMemo(() => closed(PORTUGAL_POINTS), []), 1.4, -0.2)

  // As formas são desenhadas no plano XY. Rodar +90° em X leva (x, y, z) → (x, −z, y): o y do mapa
  // passa a z no chão e o z local passa a profundidade (abaixo das estradas).
  return (
    <group>
      <mesh geometry={halo}>
        <meshBasicMaterial color={SCENE_COLORS.coastHalo} side={DoubleSide} />
      </mesh>
      <mesh geometry={spainHalo}>
        <meshBasicMaterial color={SCENE_COLORS.coastHalo} side={DoubleSide} />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, 0.9]}>
          <shapeGeometry args={[spain]} />
          <meshBasicMaterial color={SCENE_COLORS.spain} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.6]}>
          <shapeGeometry args={[portugal]} />
          <meshBasicMaterial color={SCENE_COLORS.portugal} side={DoubleSide} />
        </mesh>
      </group>
      <mesh geometry={outline}>
        <meshBasicMaterial color={SCENE_COLORS.coastline} side={DoubleSide} />
      </mesh>
    </group>
  )
}
