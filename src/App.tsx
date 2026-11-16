import { Component, lazy, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { ArrowCounterClockwise, ArrowRight, ArrowUpRight, Pause, Play, Plus, X } from '@phosphor-icons/react'
import { chapterIds, chapterNames, useCinema, useMediaQuery } from './useCinema'
import { hex, memory, memoryStages } from './memory'
import githubIcon from './assets/brands/github.svg'

const Scene = lazy(() => import('./MemoryScene'))
const github = 'https://github.com/PageFaultDev'

function BrandMark({ className = '' }: { className?: string }) {
  return <img className={`site-mark ${className}`} src="/pagefault.svg" width={32} height={32} alt="" aria-hidden="true" />
}

function GithubLink({ compact = false }: { compact?: boolean }) {
  return <a className={`github-link ${compact ? 'github-link--compact button-sm' : 'button-md'}`} href={github} target="_blank" rel="noopener noreferrer" aria-label={compact ? 'GitHub' : undefined}>
    <span className="brand-icon" style={{ width: compact ? 18 : 20, height: compact ? 18 : 20, maskImage: `url("${githubIcon}")`, WebkitMaskImage: `url("${githubIcon}")` }} aria-hidden="true" />
    <span>{compact ? 'GitHub' : '走进 GitHub'}</span>
    {!compact && <ArrowUpRight size={16} aria-hidden="true" />}
  </a>
}

function StaticSculpture({ loading = false }: { loading?: boolean }) {
  return <div className={`scene-frame static-memory ${loading ? 'is-loading' : ''}`} aria-hidden="true">
    <div className="static-volume">{['front', 'right', 'top'].map((face) => <div className={`static-face static-face--${face}`} key={face}>
      {Array.from({ length: 9 }, (_, index) => <span className={`mono ${face === 'front' && index === memory.vpn ? 'is-selected' : ''}`} key={index}>{face === 'front' ? hex(index) : ''}</span>)}
    </div>)}</div>
    {!loading && <span className="static-message caption-5">3D 视图暂不可用</span>}
  </div>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('3D view unavailable; displaying the brand sculpture.', error, info.componentStack) }
  render() { return this.state.failed ? <StaticSculpture /> : this.props.children }
}

type LegalPage = 'privacy' | 'terms' | null

function LegalDialog({ page, onClose }: { page: LegalPage, onClose: () => void }) {
  useEffect(() => {
    if (!page) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLDialogElement>('#legal-dialog')!
    dialog.showModal()
    return () => { dialog.close(); previous?.focus({ preventScroll: true }) }
  }, [page])
  return <dialog id="legal-dialog" className="legal-dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="legal-heading"><BrandMark /><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
    <h2 className="heading-4">{page === 'privacy' ? '隐私说明' : '使用说明'}</h2>
    {page === 'privacy' ? <><p className="body-3">本站用于介绍 PageFault，不设注册或信息提交表单，也不使用访问统计、广告追踪或非必要 Cookie。</p><p className="body-3">字体与 3D 资源由本站提供。访问 GitHub 等外部网站后，数据处理由相应网站的隐私政策约定。站点托管服务可能会处理提供网页所需的请求日志。</p></> : <><p className="body-3">本站展示 PageFault 的组织介绍与品牌内容。具体开源项目的使用、修改和分发，请以对应 GitHub 仓库中的许可证为准。</p><p className="body-3">网页中的 3D 视觉用于品牌表达。外部链接将打开相应网站。如需反馈问题，可以通过 PageFaultDev 的公开 GitHub 仓库参与讨论。</p></>}
    <a className="text-link button-sm" href={github} target="_blank" rel="noopener noreferrer">访问 PageFaultDev <ArrowUpRight size={16} /></a>
  </dialog>
}

function NotFound() {
  return <main className="not-found"><BrandMark /><p className="caption-4 mono">PAGE_NOT_FOUND / 404</p><h1 className="heading-1">这一页，<br />尚未写下。</h1><p className="body-3">回到 PageFault，继续探索下一页。</p><a className="github-link button-md" href="/">返回首页 <ArrowRight size={18} /></a></main>
}

function Cinema() {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const small = useMediaQuery('(max-width: 960px)')
  const [paused, setPaused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [legal, setLegal] = useState<LegalPage>(null)
  const [expanded, setExpanded] = useState(false)
  const [resetView, setResetView] = useState(0)
  const sceneFrame = useRef<HTMLDivElement>(null)
  const { track, stage, panels, progress, active, goTo } = useCinema(prefersReducedMotion)
  const memoryState = memoryStages[active]

  const navigate = (chapter: number) => { goTo(chapter); setMenuOpen(false) }

  useEffect(() => { if (!small) setMenuOpen(false) }, [small])

  useEffect(() => {
    if (!menuOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector<HTMLDialogElement>('#legal-dialog')?.open) setMenuOpen(false)
      if (event.key === 'Tab') {
        const items = Array.from(document.querySelectorAll<HTMLElement>('.menu-toggle, #mobile-menu a, #mobile-menu button:not(:disabled)'))
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.querySelector<HTMLElement>('#mobile-menu a')?.focus({ preventScroll: true })
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); previousFocus?.focus({ preventScroll: true }) }
  }, [menuOpen])

  const footerLinks = <div className="footer-links">
    <button onClick={() => setLegal('privacy')}>隐私</button>
    <button onClick={() => setLegal('terms')}>使用说明</button>
    <button className="motion-toggle" onClick={() => setPaused(!paused)} aria-pressed={paused} disabled={prefersReducedMotion} aria-label={prefersReducedMotion ? '已遵循系统减少动态效果设置' : paused ? '开启动效' : '暂停动效'}>{prefersReducedMotion || paused ? <Play size={12} /> : <Pause size={12} />}<span>{prefersReducedMotion ? '简化动态' : paused ? '开启动效' : '暂停动效'}</span></button>
  </div>

  return <>
    <a className="skip-link button-sm" href="#story-content" onClick={(event) => { event.preventDefault(); document.getElementById('story-content')?.focus({ preventScroll: true }) }}>跳到页面内容</a>
    <header className="site-header">
      <nav className="navigation" aria-label="主导航">
        <a href="#beginning" className="brand" onClick={(event) => { event.preventDefault(); navigate(0) }} aria-label="PageFault 首页"><BrandMark /><span className="title-1">PageFault<span className="brand-period">.</span></span></a>
        <div className="nav-links">
          {[['关于', 0], ['全栈', 2], ['开源', 3]].map(([label, index]) => <a key={index} href={`#${chapterIds[Number(index)]}`} className={`nav-link title-4 ${active === index ? 'is-current' : ''}`} aria-current={active === index ? 'location' : undefined} onClick={(event) => { event.preventDefault(); navigate(Number(index)) }}>{label}</a>)}
        </div>
        <div className="nav-actions"><GithubLink compact /><button className={`menu-toggle icon-button ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? '关闭菜单' : '打开菜单'} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button></div>
      </nav>
    </header>

    <div className={`mobile-menu ${menuOpen ? 'is-open' : ''}`} id="mobile-menu" role="dialog" aria-modal="true" aria-label="页面导航" inert={!menuOpen} aria-hidden={!menuOpen}>
      {chapterNames.map((name, i) => <a key={name} className="heading-3" style={{ '--item': i } as React.CSSProperties} href={`#${chapterIds[i]}`} onClick={(event) => { event.preventDefault(); navigate(i) }}><span className="caption-4 mono">0{i + 1}</span>{name}<ArrowUpRight size={24} /></a>)}
      <GithubLink />
      <footer className="menu-footer caption-5"><span className="mono">pagefault.app</span>{footerLinks}</footer>
    </div>

    <main className="story-track" ref={track} inert={menuOpen}>
      <div className="cinema-stage" ref={stage} data-chapter={active} data-progress="0" data-motion={prefersReducedMotion ? 'reduced' : paused ? 'paused' : 'full'}>
        <div className="scene-canvas">
          <SceneBoundary><Suspense fallback={<StaticSculpture loading />}><Scene frame={sceneFrame} fallback={<StaticSculpture />} progress={progress} active={active} reduced={prefersReducedMotion} paused={paused || menuOpen || legal !== null} small={small} expanded={expanded} resetView={resetView} /></Suspense></SceneBoundary>
        </div>
        <div className="scene-zone scene-frame" ref={sceneFrame} role="group" data-memory-state={memoryState.event} aria-label={`PageFault 交互式内存页立方体：${memoryState.status}。虚拟页 ${hex(memory.vpn)}，目标物理页框 ${hex(memory.pfn)}。`}>
          <div className="model-controls">
            <button className="model-reset" aria-label="重置视角" title="重置视角" onClick={() => setResetView((value) => value + 1)}><ArrowCounterClockwise size={18} aria-hidden="true" /></button>
            <button className={`model-toggle ${expanded ? 'is-expanded' : ''}`} aria-label={expanded ? '收拢结构' : '展开结构'} title={expanded ? '收拢结构' : '展开结构'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}><Plus size={18} aria-hidden="true" /></button>
          </div>
        </div>

        <div id="story-content" className="story-content" tabIndex={-1}>
          <section ref={(node) => { panels.current[0] = node }} className="chapter chapter--first" aria-labelledby="title-0" aria-hidden={active !== 0} inert={active !== 0}>
            <h1 className="heading-1 hero-heading" id="title-0">全栈构建，<br />开放创造<span className="blue-period">。</span></h1>
            <div className="chapter-copy"><p className="chapter-description body-3">PageFault 是面向全栈开发者的开源组织。<br />从第一行代码开始，把想法构建成真实。</p><GithubLink /></div>
          </section>

          <section ref={(node) => { panels.current[1] = node }} className="chapter" aria-labelledby="title-1" aria-hidden={active !== 1} inert={active !== 1}>
            <h2 className="heading-1" id="title-1">一次缺页，<br />新的可能<span className="blue-period">。</span></h2>
            <div className="chapter-copy"><p className="chapter-description body-3">PageFault，源自一次缺页。我们从尚未解决的问题出发，用代码探索新的可能。</p></div>
          </section>

          <section ref={(node) => { panels.current[2] = node }} className="chapter" aria-labelledby="title-2" aria-hidden={active !== 2} inert={active !== 2}>
            <h2 className="heading-1" id="title-2">深入每一层，<br />连接完整体验<span className="blue-period">。</span></h2>
            <div className="chapter-copy"><p className="chapter-description body-3">从界面到服务，再到基础设施。我们关注每一层，也关心它们如何协同，让想法成为完整的产品。</p></div>
          </section>

          <section ref={(node) => { panels.current[3] = node }} className="chapter chapter--manifesto" aria-labelledby="title-3" aria-hidden={active !== 3} inert={active !== 3}>
            <h2 className="heading-1" id="title-3"><span className="reveal-word">让代码</span><span className="reveal-word">开放，</span><br /><span className="reveal-word">让连接</span><span className="reveal-word">发生</span><span className="blue-period reveal-word">。</span></h2>
            <div className="chapter-copy"><p className="chapter-description body-3">让代码被看见，让想法被接续。分享、讨论与协作，是我们持续构建的方式。</p></div>
          </section>

          <section ref={(node) => { panels.current[4] = node }} className="chapter" aria-labelledby="title-4" aria-hidden={active !== 4} inert={active !== 4}>
            <h2 className="heading-1" id="title-4">继续向前，<br />一起构建<span className="blue-period">。</span></h2>
            <div className="chapter-copy"><p className="chapter-description body-3">带着你的好奇心来。阅读代码、提出想法，或提交第一次贡献，一起写下 PageFault 的下一页。</p><GithubLink /></div>
          </section>
        </div>

        <div className="cinema-bottom">
          <nav className="chapter-timeline" aria-label="故事进度">{chapterNames.map((name, i) => <button className={`timeline-step ${active === i ? 'is-active' : ''} ${active > i ? 'is-past' : ''}`} key={name} onClick={() => navigate(i)} aria-label={`跳到${name}`} aria-current={active === i ? 'step' : undefined}><span className="timeline-track"><span /></span><span className="timeline-text caption-4">{name}</span></button>)}</nav>
          <footer className="site-footer caption-5"><span className="footer-domain mono">pagefault.app <span>© {new Date().getFullYear()} PageFault</span></span>{footerLinks}</footer>
        </div>
      </div>
    </main>
    <LegalDialog page={legal} onClose={() => setLegal(null)} />
  </>
}

export default function App() {
  return window.location.pathname === '/' ? <Cinema /> : <NotFound />
}
