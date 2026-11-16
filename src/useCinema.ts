import { useCallback, useEffect, useRef, useState } from 'react'
import { memoryStages } from './memory'

export const chapterNames = memoryStages.map((stage) => stage.label)
export const chapterIds = ['beginning', 'fault', 'resident', 'mapping', 'next']
const chapterFromHash = () => {
  const hash = window.location.hash.slice(1)
  const legacy: Record<string, number> = { interface: 1, fullstack: 2, open: 3 }
  return legacy[hash] ?? chapterIds.indexOf(hash)
}
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

export function useCinema(reducedMotion: boolean) {
  const track = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const panels = useRef<(HTMLElement | null)[]>([])
  const progress = useRef(0)
  const initialHashApplied = useRef(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      if (!track.current || !stage.current) return
      const range = track.current.offsetHeight - stage.current.offsetHeight
      const value = clamp((window.scrollY - track.current.offsetTop) / Math.max(1, range))
      progress.current = value
      const chapter = Math.round(value * 4)
      setActive((current) => current === chapter ? current : chapter)
      stage.current.dataset.progress = value.toFixed(4)
      stage.current.style.setProperty('--progress', `${value}`)
      panels.current.forEach((panel, index) => {
        if (!panel) return
        const distance = value * 4 - index
        const opacity = reducedMotion ? Number(index === chapter) : clamp((0.56 - Math.abs(distance)) / 0.18)
        panel.style.opacity = `${opacity}`
        panel.style.setProperty('--chapter-offset', `${reducedMotion ? 0 : clamp(-distance, -2 / 3, 2 / 3)}`)
        panel.style.visibility = opacity > 0 ? 'visible' : 'hidden'
      })
      const words = stage.current.querySelectorAll<HTMLElement>('.reveal-word')
      words.forEach((word, index) => {
        const reveal = reducedMotion ? 1 : clamp((value * 4 - 2.5 - index * 0.065) / 0.18)
        word.style.opacity = `${0.28 + reveal * 0.72}`
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    if (stage.current) observer.observe(stage.current)
    update()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [reducedMotion])

  const goTo = useCallback((chapter: number) => {
    if (!track.current || !stage.current) return
    const index = clamp(chapter, 0, 4)
    const top = track.current.offsetTop + (track.current.offsetHeight - stage.current.offsetHeight) * index / 4
    window.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' })
    history.replaceState(null, '', `${window.location.pathname}#${chapterIds[index]}`)
  }, [reducedMotion])

  useEffect(() => {
    if (!initialHashApplied.current) {
      initialHashApplied.current = true
      const initial = chapterFromHash()
      if (initial > 0) requestAnimationFrame(() => goTo(initial))
    }
    const onHash = () => {
      const index = chapterFromHash()
      if (index >= 0) goTo(index)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [goTo])

  return { track, stage, panels, progress, active, goTo }
}
