import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three'
import type { VehicleClass } from '../../domain/types.ts'
import { poseAt } from '../../simulation/motion.ts'
import { useAssignment } from '../../store/useAssignment.ts'
import { useMapStoreApi } from '../../store/useMapStore.ts'
import { DRAW_EVERY, usePlaybackRuntime } from '../simulation/playbackContext.ts'
import { SCENE_COLORS } from './palette.ts'

/** Dimensões dos veículos low-poly (unidades do mapa; escala esquemática, não real). */
const CLASS_SHAPE: Record<VehicleClass, { length: number; width: number; height: number; color: string }> = {
  c1: { length: 2.6, width: 1.35, height: 0.9, color: '#fdfaf4' },
  c2: { length: 3.1, width: 1.45, height: 1.15, color: '#9cc4e8' },
  c3: { length: 4.0, width: 1.55, height: 1.35, color: '#f2c46d' },
  c4: { length: 5.0, width: 1.6, height: 1.45, color: '#e8935a' },
}
const BASE = 0.9

/**
 * Veículos em viagem, desenhados com dois `InstancedMesh` (carroçaria e cabine). As matrizes são
 * escritas diretamente a cada fotograma a partir da pose analítica (`poseAt`): o React não volta a
 * renderizar por veículo e o motor não é recalculado no render.
 */
export function Vehicles() {
  const runtimeRef = usePlaybackRuntime()
  const store = useMapStoreApi()
  const assignment = useAssignment()
  const capacity = Math.max(1, Math.ceil((assignment?.vehicles.length ?? 0) / DRAW_EVERY) + 1)
  const bodyRef = useRef<InstancedMesh>(null)
  const cabinRef = useRef<InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const dummy = useMemo(() => new Object3D(), [])

  // A cena regista a sua função de "novo fotograma" no controlador de reprodução.
  useEffect(() => runtimeRef?.current.registerInvalidate(() => invalidate()), [runtimeRef, invalidate])
  const colors = useMemo(
    () => Object.fromEntries(Object.entries(CLASS_SHAPE).map(([key, shape]) => [key, new Color(shape.color)])) as Record<VehicleClass, Color>,
    [],
  )

  // Cria as cores por instância antes do primeiro desenho (o shader é compilado com elas).
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    for (let index = 0; index < capacity; index++) body.setColorAt(index, colors.c1)
    body.count = 0
    if (cabinRef.current) cabinRef.current.count = 0
  }, [capacity, colors])

  useFrame(() => {
    const runtime = runtimeRef?.current
    const body = bodyRef.current
    const cabin = cabinRef.current
    if (!runtime?.engine || !body || !cabin) return
    const status = store.getState().playback.status
    const active = status === 'idle' ? [] : runtime.engine.activeAt(runtime.renderMinute, DRAW_EVERY)

    let index = 0
    for (const vehicle of active) {
      if (index >= capacity) break
      const pose = poseAt(vehicle.motion, vehicle.tripMinute)
      const shape = CLASS_SHAPE[vehicle.vehicle.vehicleClass]
      dummy.rotation.set(0, -pose.heading, 0)

      dummy.position.set(pose.point.x, BASE + shape.height / 2, pose.point.y)
      dummy.scale.set(shape.length, shape.height, shape.width)
      dummy.updateMatrix()
      body.setMatrixAt(index, dummy.matrix)
      body.setColorAt(index, colors[vehicle.vehicle.vehicleClass])

      dummy.position.set(pose.point.x, BASE + shape.height + 0.3, pose.point.y)
      dummy.scale.set(shape.length * 0.5, 0.6, shape.width * 0.85)
      dummy.updateMatrix()
      cabin.setMatrixAt(index, dummy.matrix)
      index++
    }
    body.count = index
    cabin.count = index
    body.instanceMatrix.needsUpdate = true
    cabin.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh key={`body-${capacity}`} ref={bodyRef} args={[undefined, undefined, capacity]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh key={`cabin-${capacity}`} ref={cabinRef} args={[undefined, undefined, capacity]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#5a5468" />
      </instancedMesh>
    </>
  )
}

const PULSE_MS = 650
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Feedback discreto de cobrança: um anel que se expande e desvanece no pórtico sempre que o livro
 * regista uma passagem nele. Desligado com prefers-reduced-motion.
 */
export function GantryPulse({ tollId, x, z }: { tollId: string; x: number; z: number }) {
  const runtimeRef = usePlaybackRuntime()
  const meshRef = useRef<Mesh>(null)

  useFrame(() => {
    const mesh = meshRef.current
    const started = runtimeRef?.current.pulses.get(tollId)
    if (!mesh) return
    const elapsed = started === undefined ? Number.POSITIVE_INFINITY : performance.now() - started
    if (reducedMotion || elapsed > PULSE_MS) {
      mesh.visible = false
      return
    }
    const t = elapsed / PULSE_MS
    mesh.visible = true
    mesh.scale.setScalar(1 + t * 1.8)
    ;(mesh.material as MeshBasicMaterial).opacity = 0.55 * (1 - t)
  })

  return (
    <mesh ref={meshRef} position={[x, 0.25, z]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => null}>
      <ringGeometry args={[3.2, 4.4, 40]} />
      <meshBasicMaterial color={SCENE_COLORS.tollActive} transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}
