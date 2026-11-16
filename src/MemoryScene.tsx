import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { hex, memory } from './memory'
import { useModelRotation } from './useModelRotation'

type Vec3 = [number, number, number]
type Props = {
  frame: RefObject<HTMLDivElement | null>
  fallback: ReactNode
  progress: MutableRefObject<number>
  active: number
  reduced: boolean
  paused: boolean
  small: boolean
  expanded: boolean
  resetView: number
}
// The model keeps the framing of its layout slot, while shadows can render
// across the whole stage instead of stopping at the slot's edges.
function SceneFraming({ frame, viewScale }: Pick<Props, 'frame'> & { viewScale: MutableRefObject<number> }) {
  const { camera, gl, size, invalidate } = useThree()
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !frame.current) return
    const update = () => {
      const bounds = frame.current!.getBoundingClientRect()
      const canvas = gl.domElement.getBoundingClientRect()
      if (!bounds.height || !canvas.height || !canvas.width) return
      const centerX = bounds.left + bounds.width / 2 - canvas.left
      const centerY = bounds.top + bounds.height / 2 - canvas.top
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) * canvas.height / bounds.height))
      camera.setViewOffset(canvas.width, canvas.height, canvas.width / 2 - centerX, canvas.height / 2 - centerY, canvas.width, canvas.height)
      camera.updateProjectionMatrix()
      viewScale.current = Math.min(1, 2 * 7.5 * Math.tan(THREE.MathUtils.degToRad(18)) * bounds.width / bounds.height / 4.65)
      invalidate()
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame.current)
    return () => { observer.disconnect(); camera.clearViewOffset() }
  }, [camera, frame, gl, size.width, size.height, invalidate, viewScale])
  return null
}
type Pose = { rotation: Vec3, scale: number, virtual: Vec3, physical: Vec3 }
const poses: Pose[] = [
  { rotation: [0.4, -0.62, -0.12], scale: 1.13, virtual: [0, 0, 0.83], physical: [0, 0, -0.83] },
  { rotation: [0.2, -1.85, -0.08], scale: 1.1, virtual: [0, 0, 0.94], physical: [0, 0, -0.94] },
  { rotation: [0.32, -2.8, 0.12], scale: 1.08, virtual: [0, 0, 1.05], physical: [0, 0, -1.05] },
  { rotation: [0.5, -4.25, -0.12], scale: 0.98, virtual: [0, 0, 1.38], physical: [0, 0, -1.38] },
  { rotation: [0.38, -6.9, -0.1], scale: 1.13, virtual: [0, 0, 0.83], physical: [0, 0, -0.83] },
]
const POINT_COUNT = 81
// Neighboring tangents keep rotation moving through chapter boundaries.
function poseValue(q: number, get: (pose: Pose) => number) {
  const index = Math.min(3, Math.floor(q))
  const t = q - index
  const a = get(poses[index]), b = get(poses[index + 1])
  const before = index > 0 ? get(poses[index - 1]) : 2 * a - b
  const after = index < 3 ? get(poses[index + 2]) : 2 * b - a
  const start = (b - before) / 2, end = (after - a) / 2
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a + (t ** 3 - 2 * t ** 2 + t) * start + (-2 * t ** 3 + 3 * t ** 2) * b + (t ** 3 - t ** 2) * end
}
const tilePosition = (index: number): Vec3 => [(index % 3 - 1) * 0.82, (1 - Math.floor(index / 3)) * 0.82, 0]

function roundedPlate(width: number, height: number, depth: number, radius: number) {
  const x = width / 2, y = height / 2
  const shape = new THREE.Shape()
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.quadraticCurveTo(x, -y, x, -y + radius)
  shape.lineTo(x, y - radius)
  shape.quadraticCurveTo(x, y, x - radius, y)
  shape.lineTo(-x + radius, y)
  shape.quadraticCurveTo(-x, y, -x, y - radius)
  shape.lineTo(-x, -y + radius)
  shape.quadraticCurveTo(-x, -y, -x + radius, -y)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 8 })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 16
  return texture
}

function pageTexture(index: number, physical: boolean) {
  const selected = index === (physical ? memory.pfn : memory.vpn)
  return makeTexture(768, 768, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = selected ? '#ffffff' : '#38445a'
    ctx.font = '500 252px "Geist Mono Variable", monospace'
    ctx.fillText(index.toString(16).toUpperCase().padStart(2, '0'), 384, 384)
  })
}

function entryTexture(present: boolean) {
  return makeTexture(768, 768, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = present ? '#1859ed' : '#aa7537'
    ctx.font = '500 224px "Geist Mono Variable", monospace'
    ctx.fillText('PTE', 384, 384)
  })
}

function Studio({ small }: { small: boolean }) {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.035)
    const previous = scene.environment
    scene.environment = target.texture
    invalidate()
    return () => { scene.environment = previous; target.dispose(); generator.dispose(); room.dispose() }
  }, [gl, scene, invalidate])
  return <>
    <ambientLight intensity={0.3} />
    <directionalLight position={[-3, 6, 6]} intensity={2.4} color="#ffffff" castShadow shadow-mapSize={small ? [1024, 1024] : [2048, 2048]} shadow-normalBias={0.025} shadow-bias={-0.0002} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
    <directionalLight position={[4, 1, -2]} intensity={0.7} color="#d9e4ff" />
    <directionalLight position={[-4, -1, 2]} intensity={0.3} color="#ffffff" />
  </>
}

function MemorySculpture({ progress, active, reduced, paused, small, expanded, resetView, viewScale }: Props & { viewScale: MutableRefObject<number> }) {
  const orbit = useRef<THREE.Group>(null)
  const rig = useRef<THREE.Group>(null)
  const virtual = useRef<THREE.Group>(null)
  const physical = useRef<THREE.Group>(null)
  const virtualTiles = useRef<(THREE.Group | null)[]>([])
  const physicalTiles = useRef<(THREE.Group | null)[]>([])
  const entryPending = useRef<THREE.Mesh>(null)
  const entryPresent = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Group>(null)
  const packet = useRef<THREE.Mesh>(null)
  const renderedProgress = useRef(0)
  const animationTime = useRef(0)
  const modelRotation = useModelRotation(resetView)
  const separation = useRef(0)
  const { invalidate, gl } = useThree()

  const assets = useMemo(() => {
    const tile = roundedPlate(0.7, 0.7, 0.62, 0.055)
    const entry = roundedPlate(0.7, 0.7, 0.62, 0.055)
    const white = new THREE.MeshPhysicalMaterial({ color: '#e5eaf2', roughness: 0.45, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 0.45 })
    const blue = new THREE.MeshPhysicalMaterial({ color: '#1754e8', roughness: 0.35, metalness: 0.05, clearcoat: 0.25, envMapIntensity: 0.35 })
    const resident = blue.clone()
    resident.transparent = true
    const backing = new THREE.MeshPhysicalMaterial({ color: '#c9d2e1', roughness: 0.45, metalness: 0.18, clearcoat: 0.2, envMapIntensity: 0.45 })
    const virtualTextures = Array.from({ length: 9 }, (_, i) => pageTexture(i, false))
    const physicalTextures = Array.from({ length: 9 }, (_, i) => pageTexture(i, true))
    const entries = [entryTexture(false), entryTexture(true)]
    const mappedMaterial = new THREE.LineBasicMaterial({ color: '#1859ed', transparent: true, opacity: 0 })
    const mappedGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3))
    const mappedLine = new THREE.Line(mappedGeometry, mappedMaterial)
    mappedLine.frustumCulled = false
    const points = Array.from({ length: 5 }, () => new THREE.Vector3())
    const curve = new THREE.CatmullRomCurve3(points)
    const sample = new THREE.Vector3()
    const ghostBox = new THREE.BoxGeometry(0.7, 0.7, 0.62)
    const ghostGeometry = new THREE.EdgesGeometry(ghostBox)
    ghostBox.dispose()
    const ghostMaterial = new THREE.LineDashedMaterial({ color: '#91a5c5', dashSize: 0.055, gapSize: 0.04, transparent: true, opacity: 0.8 })
    const ghostOutline = new THREE.LineSegments(ghostGeometry, ghostMaterial)
    ghostOutline.computeLineDistances()
    return { tile, entry, white, blue, resident, backing, virtualTextures, physicalTextures, entries, mappedLine, curve, sample, ghostOutline }
  }, [])

  useEffect(() => { invalidate() }, [active, reduced, paused, expanded, small, invalidate])
  useEffect(() => {
    gl.domElement.dataset.model = 'memory-page-volume'
    return () => {
      assets.tile.dispose(); assets.entry.dispose()
      ;[assets.white, assets.blue, assets.resident, assets.backing].forEach((material) => material.dispose())
      ;[...assets.virtualTextures, ...assets.physicalTextures, ...assets.entries].forEach((texture) => texture.dispose())
      ;[assets.mappedLine, assets.ghostOutline].forEach((line) => { line.geometry.dispose(); line.material.dispose() })
    }
  }, [assets, gl])

  useFrame((_, delta) => {
    if (!rig.current || !virtual.current || !physical.current) return
    const safeDelta = Math.min(delta, 0.05)
    if (reduced) renderedProgress.current = active
    else if (!paused) {
      const current = renderedProgress.current
      const next = THREE.MathUtils.damp(current, progress.current * 4, 2, safeDelta)
      // A large scroll or chapter jump must never become a rapid spin.
      renderedProgress.current += THREE.MathUtils.clamp(next - current, -safeDelta * 1.25, safeDelta * 1.25)
      animationTime.current += safeDelta
    }
    const q = renderedProgress.current
    const damping = reduced || paused ? 1 : 1 - Math.exp(-safeDelta * 8)
    const readiness = THREE.MathUtils.smoothstep(q, 1.3, 2)
    const mapped = THREE.MathUtils.smoothstep(q, 2.5, 3)
    const fault = THREE.MathUtils.smoothstep(q, 0.3, 0.85) * (1 - mapped)
    const time = animationTime.current
    separation.current = THREE.MathUtils.lerp(separation.current, expanded ? 0.65 : 0, damping)
    const spread = separation.current
    if (!paused || reduced) {
      rig.current.rotation.x = THREE.MathUtils.lerp(rig.current.rotation.x, poseValue(q, (pose) => pose.rotation[0]), damping)
      rig.current.rotation.y = THREE.MathUtils.lerp(rig.current.rotation.y, poseValue(q, (pose) => pose.rotation[1]), damping)
      rig.current.rotation.z = THREE.MathUtils.lerp(rig.current.rotation.z, poseValue(q, (pose) => pose.rotation[2]), damping)
    }
    rig.current.position.y = reduced ? 0.08 : 0.08 + Math.sin(time * 0.65) * 0.025
    rig.current.scale.setScalar(poseValue(q, (pose) => pose.scale) * (small ? 0.96 : 1) * viewScale.current * (1 - spread * (small ? 0.32 : 0.14)))
    virtual.current.position.set(0, 0, poseValue(q, (pose) => pose.virtual[2]) + spread)
    physical.current.position.set(0, 0, poseValue(q, (pose) => pose.physical[2]) - spread)
    if (orbit.current) {
      orbit.current.rotation.y = THREE.MathUtils.lerp(orbit.current.rotation.y, modelRotation.current.yaw, damping)
      orbit.current.rotation.x = THREE.MathUtils.lerp(orbit.current.rotation.x, modelRotation.current.pitch, damping)
      gl.domElement.dataset.userYaw = orbit.current.rotation.y.toFixed(4)
      gl.domElement.dataset.userPitch = orbit.current.rotation.x.toFixed(4)
    }
    virtualTiles.current.forEach((tile, i) => {
      if (!tile) return
      const position = tilePosition(i)
      tile.position.set(position[0] * (1 + spread * 0.12), position[1] * (1 + spread * 0.12), i === memory.vpn ? 0.07 + fault * 0.32 : 0)
    })
    physicalTiles.current.forEach((tile, i) => {
      if (!tile) return
      const position = tilePosition(i)
      if (i === memory.pfn) {
        tile.visible = readiness > 0.001
        tile.position.set(position[0] + (1 - readiness) * 1.2, position[1] - (1 - readiness) * 0.6, -(1 - readiness) * 1.2)
        assets.resident.opacity = readiness
        tile.scale.setScalar(0.88 + readiness * 0.12)
      } else tile.position.set(position[0] * (1 + spread * 0.12), position[1] * (1 + spread * 0.12), 0)
    })
    if (ghost.current) ghost.current.visible = readiness < 0.99
    if (entryPending.current) entryPending.current.visible = mapped < 0.5
    if (entryPresent.current) entryPresent.current.visible = mapped >= 0.5

    const source = virtualTiles.current[memory.vpn]!
    const destination = physicalTiles.current[memory.pfn]!
    const points = assets.curve.points
    points[0].copy(virtual.current.position).add(source.position)
    points[0].z += 0.35
    points[1].set(-1.45, -0.75, virtual.current.position.z + 0.45)
    points[2].set(-1.55, -1.35, 0)
    points[3].set(-0.8, -1.4, physical.current.position.z - 0.45)
    const target = tilePosition(memory.pfn)
    points[4].copy(physical.current.position)
    points[4].x += target[0]; points[4].y += target[1]; points[4].z -= 0.35
    for (let i = 0; i < POINT_COUNT; i++) {
      assets.curve.getPoint(i / (POINT_COUNT - 1), assets.sample)
      assets.mappedLine.geometry.attributes.position.setXYZ(i, assets.sample.x, assets.sample.y, assets.sample.z)
    }
    assets.mappedLine.geometry.attributes.position.needsUpdate = true
    assets.mappedLine.geometry.setDrawRange(0, Math.floor(POINT_COUNT * mapped))
    assets.mappedLine.material.opacity = mapped * 0.9
    if (packet.current) {
      packet.current.visible = mapped > 0.98
      const travel = reduced ? 0.88 : (time * (q > 3.5 ? 0.24 : 0.12)) % 1
      assets.curve.getPoint(travel, packet.current.position)
    }
    gl.domElement.dataset.present = mapped >= 0.5 ? '1' : '0'
    gl.domElement.dataset.resident = readiness >= 0.99 ? '1' : '0'
    gl.domElement.dataset.modelProgress = (q / 4).toFixed(5)
    gl.domElement.dataset.expansion = spread.toFixed(4)
    gl.domElement.dataset.rotationY = rig.current.rotation.y.toFixed(4)
    // Keep the allocation animation separate from page-table presence.
    if (destination) destination.userData.resident = readiness >= 0.99
  })

  const renderArray = (isPhysical: boolean) => <group ref={isPhysical ? physical : virtual} position={isPhysical ? poses[0].physical : poses[0].virtual} name={isPhysical ? 'physical-frames' : 'virtual-pages'}>
    {Array.from({ length: 9 }, (_, index) => {
      const selected = index === (isPhysical ? memory.pfn : memory.vpn)
      return <group key={index} ref={(node) => { (isPhysical ? physicalTiles : virtualTiles).current[index] = node }} position={tilePosition(index)} visible={!(isPhysical && selected)} name={`${isPhysical ? 'pfn' : 'vpn'}-${hex(index)}`}>
        <mesh geometry={assets.tile} material={selected ? isPhysical ? assets.resident : assets.blue : assets.white} castShadow receiveShadow />
        <mesh position={[0, 0, isPhysical ? -0.333 : 0.333]} rotation={[0, isPhysical ? Math.PI : 0, 0]}><planeGeometry args={[0.7, 0.7]} /><meshBasicMaterial map={(isPhysical ? assets.physicalTextures : assets.virtualTextures)[index]} transparent depthWrite={false} /></mesh>
      </group>
    })}
    {isPhysical && <group ref={ghost} position={tilePosition(memory.pfn)}><primitive object={assets.ghostOutline} /></group>}
  </group>

  return <>
    <group ref={orbit}><group ref={rig} rotation={poses[0].rotation}>
      {renderArray(false)}
      {renderArray(true)}
      {Array.from({ length: 9 }, (_, i) => i === memory.vpn ? null : <mesh key={i} geometry={assets.tile} material={assets.backing} position={tilePosition(i)} castShadow receiveShadow />)}
      <primitive object={assets.mappedLine} />
      <mesh ref={packet}><sphereGeometry args={[0.045, 12, 12]} /><meshBasicMaterial color="#1859ed" /></mesh>
      <group>
        <mesh geometry={assets.entry} material={assets.white} castShadow receiveShadow />
        <mesh ref={entryPending} position={[0, 0, 0.333]}><planeGeometry args={[0.7, 0.7]} /><meshBasicMaterial map={assets.entries[0]} transparent depthWrite={false} /></mesh>
        <mesh ref={entryPresent} position={[0, 0, 0.334]} visible={false}><planeGeometry args={[0.7, 0.7]} /><meshBasicMaterial map={assets.entries[1]} transparent depthWrite={false} /></mesh>
      </group>
    </group></group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.15, 0]} receiveShadow><planeGeometry args={[20, 20]} /><shadowMaterial transparent opacity={0.08} /></mesh>
  </>
}

export default function MemoryScene(props: Props) {
  const viewScale = useRef(1)
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <Canvas shadows camera={{ position: [0, 0.2, 7.5], fov: 36, near: 0.1, far: 30, manual: true }} dpr={[1.5, props.small ? 2.5 : 3]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} frameloop={props.reduced || props.paused || !visible ? 'demand' : 'always'} fallback={props.fallback} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.9 }}>
    <SceneFraming frame={props.frame} viewScale={viewScale} />
    <Studio small={props.small} />
    <MemorySculpture {...props} viewScale={viewScale} />
  </Canvas>
}
