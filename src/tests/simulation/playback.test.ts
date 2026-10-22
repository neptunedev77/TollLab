/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, demoDemand } from '../../data/demoDemand.ts'
import { demoNetwork } from '../../data/demoNetwork.ts'
import { edgeCurve, pointAlong } from '../../domain/geometry.ts'
import { setTollActive, setTollTariff } from '../../domain/tolls.ts'
import { assignTraffic } from '../../simulation/assignment.ts'
import { directedKey } from '../../simulation/costs.ts'
import { chargePeriod } from '../../simulation/economics.ts'
import { createMotionGeometry, LANE_OFFSET, poseAt, prepareRoute } from '../../simulation/motion.ts'
import { createPlayback, DEMAND_WINDOW_MIN, STEP_MIN } from '../../simulation/playback.ts'

const assignment = assignTraffic(demoNetwork, demoNetwork.tolls, demoDemand, { seed: DEFAULT_SEED })
const geometry = createMotionGeometry(demoNetwork)
const durationsOf = (route: NonNullable<(typeof assignment.vehicles)[number]['route']>) =>
  route.map((step) => assignment.flows.get(directedKey(step.edgeId, step.from))?.timeMin ?? 0)

/** Um veículo de cada par origem–destino, para cobrir percursos variados (com vários passos e curvas). */
const sample = [...new Map(assignment.vehicles.map((v) => [`${v.originId}>${v.destinationId}`, v])).values()]

describe('movimento ao longo do percurso', () => {
  it('parte exatamente da origem e chega exatamente ao destino', () => {
    for (const vehicle of sample) {
      const motion = prepareRoute(geometry, vehicle.route ?? [], durationsOf(vehicle.route ?? []))
      if (!motion) throw new Error(`sem movimento para ${vehicle.id}`)
      const origin = demoNetwork.layout.nodePositions[vehicle.originId]
      const destination = demoNetwork.layout.nodePositions[vehicle.destinationId]
      const start = poseAt(motion, 0).center
      const end = poseAt(motion, motion.durationMin).center
      expect(Math.hypot(start.x - (origin?.x ?? 0), start.y - (origin?.y ?? 0))).toBeLessThan(1e-6)
      expect(Math.hypot(end.x - (destination?.x ?? 0), end.y - (destination?.y ?? 0))).toBeLessThan(1e-6)
    }
  })

  it('não salta: entre amostras próximas, a deslocação respeita a velocidade de cada troço', () => {
    const dt = 0.02
    for (const vehicle of sample) {
      const motion = prepareRoute(geometry, vehicle.route ?? [], durationsOf(vehicle.route ?? []))
      if (!motion) throw new Error('sem movimento')
      const maxSpeed = Math.max(...motion.steps.map((step) => step.geometry.length / step.durationMin))
      let previous = poseAt(motion, 0)
      for (let t = dt; t <= motion.durationMin; t += dt) {
        const pose = poseAt(motion, t)
        const moved = Math.hypot(pose.center.x - previous.center.x, pose.center.y - previous.center.y)
        expect(moved).toBeLessThanOrEqual(maxSpeed * dt * 1.01 + 1e-9)
        previous = pose
      }
    }
  })

  it('roda de forma suave, mesmo ao mudar de troço num nó', () => {
    const dt = 0.02
    let worst = 0
    for (const vehicle of sample) {
      const motion = prepareRoute(geometry, vehicle.route ?? [], durationsOf(vehicle.route ?? []))
      if (!motion) throw new Error('sem movimento')
      let previous = poseAt(motion, 0).heading
      for (let t = dt; t <= motion.durationMin; t += dt) {
        const heading = poseAt(motion, t).heading
        const change = Math.abs(Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous)))
        worst = Math.max(worst, change)
        previous = heading
      }
    }
    expect(worst).toBeLessThan(0.35)
  })

  it('circula na faixa da direita do sentido de marcha', () => {
    const vehicle = sample[0]
    const motion = vehicle && prepareRoute(geometry, vehicle.route ?? [], durationsOf(vehicle.route ?? []))
    if (!motion) throw new Error('sem movimento')
    const pose = poseAt(motion, motion.durationMin / 3)
    const offset = { x: pose.point.x - pose.center.x, y: pose.point.y - pose.center.y }
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(LANE_OFFSET)
    // Direita da direção (cos h, sin h) num plano com y para baixo: produto vetorial positivo.
    expect(Math.cos(pose.heading) * offset.y - Math.sin(pose.heading) * offset.x).toBeGreaterThan(0)
  })

  it('recusa percursos com troços inexistentes ou durações inválidas', () => {
    expect(prepareRoute(geometry, [{ edgeId: 'nao-existe', from: 'a', to: 'b' }], [5])).toBeNull()
    expect(prepareRoute(geometry, [{ edgeId: 'a3-porto-maia', from: 'porto', to: 'maia' }], [0])).toBeNull()
    expect(prepareRoute(geometry, [], [])).toBeNull()
  })
})

describe('reprodução no tempo', () => {
  it('as partidas ficam na janela de procura e ninguém circula antes de partir', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    expect(playback.activeAt(0)).toHaveLength(0)
    const midway = playback.activeAt(DEMAND_WINDOW_MIN / 2)
    expect(midway.length).toBeGreaterThan(0)
    for (const active of midway) {
      expect(active.tripMinute).toBeGreaterThanOrEqual(0)
      expect(active.tripMinute).toBeLessThanOrEqual(active.motion.durationMin)
    }
  })

  it('no fim, o livro da reprodução tem exatamente as passagens da cobrança do período', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    playback.advanceTo(Number.POSITIVE_INFINITY)
    const stats = playback.stats()
    const period = chargePeriod(demoNetwork, demoNetwork.tolls, assignment)

    expect(stats.finished).toBe(true)
    expect(stats.arrived).toBe(assignment.summary.routed)
    expect(stats.travelling).toBe(0)
    expect([...playback.events].map((e) => e.id).sort()).toEqual(period.events.map((e) => e.id).sort())
    expect(stats.grossCents).toBe(period.report.grossCents)
  })

  it('cada cobrança acontece quando o veículo está em cima do pórtico', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    const tolls = new Map(demoNetwork.tolls.map((t) => [t.id, t]))
    let checked = 0
    // Tal como na aplicação, o motor avança um passo fixo de cada vez.
    for (let minute = STEP_MIN; minute <= 40 && checked < 300; minute += STEP_MIN) {
      for (const event of playback.advanceTo(minute)) {
        const active = playback.activeAt(playback.now).find((v) => v.id === event.vehicleId)
        const toll = tolls.get(event.tollId)
        const curve = toll && edgeCurve(demoNetwork, toll.edgeId)
        const gantry = curve && toll ? pointAlong(curve, toll.position)?.point : undefined
        if (!active || !gantry || event.atMinute === null) continue
        // O motor regista a passagem no passo fixo em que ela acontece: no máximo STEP_MIN de atraso.
        const pose = poseAt(active.motion, event.atMinute)
        expect(Math.hypot(pose.center.x - gantry.x, pose.center.y - gantry.y)).toBeLessThan(0.05)
        expect(active.tripMinute - event.atMinute).toBeLessThanOrEqual(STEP_MIN + 1e-9)
        expect(active.tripMinute - event.atMinute).toBeGreaterThanOrEqual(-1e-9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('o resultado não depende do tamanho dos saltos de tempo (taxa de fotogramas)', () => {
    const smooth = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    for (let minute = 0; minute <= 80; minute += 1 / 60) smooth.advanceTo(minute)
    const jumpy = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    for (const minute of [3, 17.5, 41, 80]) jumpy.advanceTo(minute)
    expect(jumpy.events.map((e) => e.id)).toEqual(smooth.events.map((e) => e.id))
    expect(jumpy.stats()).toEqual(smooth.stats())
  })

  it('reiniciar volta ao início e repete os mesmos eventos', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    playback.advanceTo(30)
    const first = playback.events.map((e) => e.id)
    playback.reset()
    expect(playback.now).toBe(0)
    expect(playback.events).toHaveLength(0)
    playback.advanceTo(30)
    expect(playback.events.map((e) => e.id)).toEqual(first)
  })

  it('mudar a tarifa a meio: veículos em viagem mantêm o percurso, novas passagens usam a tarifa nova', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    playback.advanceTo(20)
    const travelling = new Map(playback.activeAt(20).map((v) => [v.id, v.vehicle.route]))
    const before = playback.events.length

    const edit = setTollTariff(demoNetwork, demoNetwork.tolls, 'toll-a3-maia', 'c1', 900)
    if (!edit.ok) throw new Error(edit.message)
    playback.setPlan(assignTraffic(demoNetwork, edit.tolls, demoDemand, { seed: DEFAULT_SEED }), edit.tolls)

    for (const active of playback.activeAt(20)) expect(active.vehicle.route).toBe(travelling.get(active.id))
    playback.advanceTo(Number.POSITIVE_INFINITY)
    const later = playback.events.slice(before).filter((e) => e.tollId === 'toll-a3-maia' && e.vehicleClass === 'c1')
    expect(later.length).toBeGreaterThan(0)
    expect(later.every((e) => e.tariffCents === 900)).toBe(true)
    expect(new Set(playback.events.map((e) => e.id)).size).toBe(playback.events.length)
  })

  it('desativar um pórtico a meio deixa de cobrar nele a partir desse momento', () => {
    const playback = createPlayback(demoNetwork, assignment, demoNetwork.tolls, DEFAULT_SEED)
    playback.advanceTo(25)
    const edit = setTollActive(demoNetwork, demoNetwork.tolls, 'toll-a4-penafiel', false)
    if (!edit.ok) throw new Error(edit.message)
    const before = playback.events.length
    playback.setPlan(assignTraffic(demoNetwork, edit.tolls, demoDemand, { seed: DEFAULT_SEED }), edit.tolls)
    playback.advanceTo(Number.POSITIVE_INFINITY)
    expect(playback.events.slice(before).some((e) => e.tollId === 'toll-a4-penafiel')).toBe(false)
  })
})
