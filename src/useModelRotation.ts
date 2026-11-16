import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

export function useModelRotation(resetView: number) {
  const { gl, invalidate } = useThree()
  const target = useRef({ yaw: 0, pitch: 0, dragging: false })

  useEffect(() => {
    target.current.yaw = 0
    target.current.pitch = 0
    invalidate()
  }, [resetView, invalidate])

  useEffect(() => {
    const canvas = gl.domElement
    let gesture: { id: number, x: number, y: number, yaw: number, pitch: number, touch: boolean, claimed: boolean } | null = null
    const previousCursor = canvas.style.cursor
    canvas.style.cursor = 'grab'
    canvas.style.touchAction = 'pan-y pinch-zoom'
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', '内存页立方体模型。拖拽或使用方向键旋转，按 R 重置视角。')
    canvas.dataset.dragging = 'false'

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: target.current.yaw, pitch: target.current.pitch, touch: event.pointerType === 'touch', claimed: event.pointerType !== 'touch' }
      if (gesture.claimed) {
        canvas.setPointerCapture(event.pointerId)
        canvas.focus({ preventScroll: true })
        target.current.dragging = true
        canvas.dataset.dragging = 'true'
        canvas.style.cursor = 'grabbing'
      }
    }
    const move = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
      if (!gesture.claimed) {
        // Vertical touch gestures remain native page scrolling.
        if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 6) return
        gesture.claimed = true
        canvas.setPointerCapture(event.pointerId)
        target.current.dragging = true
        canvas.dataset.dragging = 'true'
      }
      if (event.cancelable) event.preventDefault()
      target.current.yaw = gesture.yaw + dx * 0.008
      target.current.pitch = Math.max(-1.15, Math.min(1.15, gesture.pitch + dy * 0.006))
      invalidate()
    }
    const finish = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return
      gesture = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      target.current.dragging = false
      canvas.dataset.dragging = 'false'
      canvas.style.cursor = 'grab'
      invalidate()
    }
    const key = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.3 : 0.15
      if (event.key === 'ArrowLeft') target.current.yaw -= step
      else if (event.key === 'ArrowRight') target.current.yaw += step
      else if (event.key === 'ArrowUp') target.current.pitch -= step
      else if (event.key === 'ArrowDown') target.current.pitch += step
      else if (event.key.toLowerCase() === 'r' || event.key === 'Home') { target.current.yaw = 0; target.current.pitch = 0 }
      else return
      target.current.pitch = Math.max(-1.15, Math.min(1.15, target.current.pitch))
      event.preventDefault()
      invalidate()
    }
    const reset = () => { target.current.yaw = 0; target.current.pitch = 0; invalidate() }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move, { passive: false })
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
    canvas.addEventListener('lostpointercapture', finish)
    canvas.addEventListener('keydown', key)
    canvas.addEventListener('dblclick', reset)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
      canvas.removeEventListener('lostpointercapture', finish)
      canvas.removeEventListener('keydown', key)
      canvas.removeEventListener('dblclick', reset)
      canvas.style.cursor = previousCursor
    }
  }, [gl, invalidate])

  return target
}
