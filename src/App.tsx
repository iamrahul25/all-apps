import { ArrowRight, ChartNoAxesColumnIncreasing, CheckCircle2, Code2, Coffee, Database, Download, ExternalLink, Globe2, GraduationCap, History, Home, ImageIcon, Lightbulb, LogOut, Mail, Menu, MessageSquareWarning, MessagesSquare, Moon, Plus, RefreshCw, Settings, ShieldCheck, Smartphone, Sun, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import heroDark from './assets/hero-dark.webp'
import heroDarkSmall from './assets/hero-dark-768.webp'
import heroLight from './assets/hero-light.webp'
import heroLightSmall from './assets/hero-light-768.webp'
import { clearAdminSession, useAdminSession } from './lib/admin'
import { adminLogin, createRequest, deleteRequest, listRequests, type PublicRequest } from './lib/api'
import projects from './data/projects.json'
import { useFileLastUpdated } from './lib/github'
import { toggleTheme, useTheme } from './lib/theme'
import { formatTimeAgo, useNow } from './lib/time'
import { FeedbackPickerPage, FeedbackRoute } from './pages/FeedbackPage'

type AppProject = { name: string; slug: string; description: string; status?: string; tags?: string[]; version: string; downloads?: string; size?: string; accent: string; initials: string; icon?: string; screenshot?: string; apkUrl: string; repoUrl?: string }
type WebsiteProject = { name: string; slug: string; description: string; url: string; repoUrl?: string; image?: string; tags: string[]; tone: string }
const apps: AppProject[] = projects.apps
const websites: WebsiteProject[] = projects.websites
const appIcons = import.meta.glob<string>('./assets/app-icons/*', { eager: true, query: '?url', import: 'default' })
const appScreenshots = import.meta.glob<string>('./assets/app-screenshots/*', { eager: true, query: '?url', import: 'default' })
const sitePreviews = import.meta.glob<string>('./assets/site-previews/*', { eager: true, query: '?url', import: 'default' })

// GitHub "blob" links open a preview page; "raw" redirects to the actual file, which browsers download.
function getApkUrl(url: string) { return url.replace('/blob/', '/raw/') }

const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' })
const formatUpdatedDate = (date: Date) => `${date.getDate()} ${shortMonth.format(date)} ${date.getFullYear()}`

function AppUpdated({ apkUrl }: { apkUrl: string }) {
  const { updated, refreshing, refresh } = useFileLastUpdated(apkUrl)
  const now = useNow(60_000)
  const refreshButton = <button type="button" className={`app-updated-refresh${refreshing ? ' is-spinning' : ''}`} onClick={refresh} disabled={refreshing} aria-label="Refresh last updated date" title="Refresh"><RefreshCw size={12} /></button>
  if (updated.status === 'ready') return <p className="app-updated"><History size={14} /> Updated <time dateTime={updated.date.toISOString()} title={updated.date.toLocaleString()}>{formatUpdatedDate(updated.date)}</time> <span className="time-ago">({formatTimeAgo(updated.date, now)})</span>{refreshButton}</p>
  if (updated.status === 'error') return <p className="app-updated"><a href={apkUrl} target="_blank" rel="noreferrer">View release on GitHub <ExternalLink size={11} /></a>{refreshButton}</p>
  return <p className="app-updated is-loading"><History size={14} /> Checking GitHub…</p>
}

// lucide-react no longer ships brand icons, so the GitHub mark is inlined.
function GitHubIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>
}

function SourceLink({ name, repoUrl }: { name: string; repoUrl: string }) {
  return <a className="source-link" href={repoUrl} target="_blank" rel="noreferrer" aria-label={`View ${name} source code on GitHub (opens in a new tab)`}><GitHubIcon size={14} /> Source code</a>
}

function FeedbackLink({ name, slug }: { name: string; slug: string }) {
  return <Link className="source-link" to={`/suggest/${slug}`} aria-label={`Give feedback on ${name}`}><MessagesSquare size={14} /> Give feedback</Link>
}

function PhoneSkeleton() {
  return <div className="phone-skeleton"><span className="sk-title" /><span className="sk-sub" /><span className="sk-row" /><span className="sk-row" /><span className="sk-row" /><span className="sk-row" /><span className="sk-fab" /></div>
}

function AppCard({ app }: { app: AppProject }) {
  const iconUrl = app.icon ? appIcons[`./assets/app-icons/${app.icon}`] : undefined
  const screenshotUrl = app.screenshot ? appScreenshots[`./assets/app-screenshots/${app.screenshot}`] : undefined
  return <article className="app-card" style={{ '--app-accent': app.accent } as React.CSSProperties}>
    <div className="app-card-top">
      <div className="app-card-info">
        <div className="app-card-head"><div className={`app-icon${iconUrl ? ' has-image' : ''}`}>{iconUrl ? <img src={iconUrl} alt="" width={56} height={56} loading="lazy" /> : <span>{app.initials}</span>}</div>{app.status && <span className="app-status">{app.status}</span>}</div>
        <h3>{app.name}</h3><p>{app.description}</p>
        {app.tags && app.tags.length > 0 && <ul className="app-tags">{app.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
      </div>
      <div className="app-phone">{screenshotUrl ? <img src={screenshotUrl} alt={`${app.name} screenshot`} loading="lazy" /> : <PhoneSkeleton />}</div>
    </div>
    <ul className="app-meta"><li><History size={14} /> v{app.version}</li><li>{app.downloads ? <><Download size={14} /> {app.downloads} downloads</> : <span className="app-new">New</span>}</li>{app.size && <li><Database size={14} /> {app.size}</li>}</ul>
    <AppUpdated apkUrl={app.apkUrl} />
    <a className="download-button" href={getApkUrl(app.apkUrl)} download rel="noreferrer" aria-label={`Download ${app.name} APK${app.size ? ` (${app.size})` : ''}`}><Download size={16} /> Download APK</a>
    <div className="card-links">{app.repoUrl && <SourceLink name={app.name} repoUrl={app.repoUrl} />}<FeedbackLink name={app.name} slug={app.slug} /></div>
  </article>
}

function AndroidIcon() {
  return <svg className="android-icon" viewBox="0 0 64 72" aria-hidden="true"><path d="M22 9 17 2M42 9l5-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M10 27a22 22 0 0 1 44 0Z" /><circle cx="23" cy="18" r="2.5" fill="#fff" /><circle cx="41" cy="18" r="2.5" fill="#fff" /><path d="M10 30h44v24a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5Z" /><rect x="1" y="31" width="7" height="22" rx="3.5" /><rect x="56" y="31" width="7" height="22" rx="3.5" /><rect x="20" y="55" width="7" height="15" rx="3.5" /><rect x="37" y="55" width="7" height="15" rx="3.5" /></svg>
}

function AppsHeroArt() {
  return <div className="apps-hero-art" aria-hidden="true">
    <span className="apps-art-blob" />
    <span className="apps-doodle">Tools in your pocket<svg viewBox="0 0 30 34"><path d="M10 2c-6 9 10 14 5 30M9 26l6 7 5-8" /></svg></span>
    <span className="apps-art-phone"><AndroidIcon /></span>
    <span className="apps-art-tile tile-image"><ImageIcon size={26} /></span>
    <span className="apps-art-tile tile-download"><Download size={26} /></span>
    <span className="apps-art-tile tile-settings"><Settings size={26} /></span>
  </div>
}

function MoreSoonCard() {
  return <article className="more-soon-card">
    <span className="more-soon-icon"><Plus size={24} /></span>
    <div><p className="eyebrow">More soon</p><h3>There are a few more ideas taking shape.</h3><p>Stay tuned for more useful apps!</p></div>
    <div className="more-soon-deco"><span className="more-soon-chip">in progress</span><svg className="more-soon-plane" viewBox="0 0 150 72" aria-hidden="true"><path className="plane-trail" d="M18 66C50 74 72 50 104 44" /><g transform="translate(88 4)"><path d="M60 2 2 20l22 8Z" fill="#a993ff" /><path d="M60 2 24 28l16 16Z" fill="#7c5cf0" /><path d="m24 28 4 14 6-6Z" fill="#5b3fd0" /></g></svg></div>
  </article>
}

function WebsiteCard({ site }: { site: WebsiteProject }) {
  const previewUrl = site.image ? sitePreviews[`./assets/site-previews/${site.image}`] : undefined
  return <article className="website-card">
    <a className="website-link" href={site.url} target="_blank" rel="noreferrer" aria-label={`Open ${site.name} (opens in a new tab)`}>
      <div className={`site-preview ${site.tone}${previewUrl ? ' has-image' : ''}`}>{previewUrl ? <img src={previewUrl} alt="" loading="lazy" /> : <span>{site.name.slice(0, 2).toUpperCase()}</span>}</div>
      <div className="website-copy"><strong>{site.name}</strong><ExternalLink size={15} /><p>{site.description}</p>{site.tags.length > 0 && <ul className="site-tags">{site.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}</div>
    </a>
    <div className="card-links">{site.repoUrl && <SourceLink name={site.name} repoUrl={site.repoUrl} />}<FeedbackLink name={site.name} slug={site.slug} /></div>
  </article>
}

function WebsitesGrid() {
  return <div className="website-grid">{websites.map((site) => <WebsiteCard key={site.name} site={site} />)}</div>
}

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/websites', label: 'Websites', icon: Globe2 },
  { to: '/apps', label: 'Apps', icon: Smartphone },
  { to: '/suggest', label: 'Feedback', icon: MessagesSquare },
  { to: '/problem', label: 'Problem', icon: MessageSquareWarning },
  { to: '/demand', label: 'Demand', icon: Lightbulb },
  { to: '/about', label: 'About', icon: UserRound },
]

function ThemeToggle({ iconSize }: { iconSize: number }) {
  const isDark = useTheme() === 'dark'
  const Icon = isDark ? Sun : Moon
  return <button className="theme-toggle" type="button" onClick={toggleTheme} aria-pressed={isDark} aria-label="Dark mode"><Icon size={iconSize} /> {isDark ? 'Light mode' : 'Dark mode'}</button>
}

function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileNavRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const isAdmin = useAdminSession() !== null
  // Opening an item at /suggest/<app>/<id> must keep the board mounted, so pages are keyed by their first two segments.
  const pageKey = pathname.split('/').slice(0, 3).join('/')

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [pageKey])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideTap = (event: PointerEvent) => { if (!mobileNavRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideTap)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsideTap); document.removeEventListener('keydown', closeOnEscape) }
  }, [menuOpen])

  return <main>
    <aside className="sidebar"><Link className="wordmark" to="/">RK<span>.</span></Link><nav className="side-nav" aria-label="Primary navigation">
      {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={16} /> {label}</NavLink>)}
    </nav>{isAdmin && <Link className="admin-badge" to="/admin" title="Logged in as admin"><ShieldCheck size={14} /> Admin</Link>}<div className="sidebar-footer"><ThemeToggle iconSize={15} /><span className="build-note">Build<br />Ideas<br />Ship<br />Repeat <ArrowRight size={14} /></span></div></aside>
    <nav className="mobile-topbar" aria-label="Mobile navigation" ref={mobileNavRef}><Link className="wordmark" to="/">RK<span>.</span></Link><button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className={`mobile-menu${menuOpen ? ' open' : ''}`} id="mobile-menu">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}><Icon size={16} /> {label}</NavLink>)}{isAdmin && <NavLink className="mobile-admin-link" to="/admin" onClick={() => setMenuOpen(false)}><ShieldCheck size={16} /> Admin</NavLink>}<ThemeToggle iconSize={16} /></div></nav>
    <div className="dashboard" key={pageKey}>{children}</div>
  </main>
}

const heroImages = { light: { large: heroLight, small: heroLightSmall }, dark: { large: heroDark, small: heroDarkSmall } }

function HeroArt() {
  const { large, small } = heroImages[useTheme()]
  return <div className="hero-art"><img src={large} srcSet={`${small} 768w, ${large} 1536w`} sizes="(max-width: 760px) 100vw, 60vw" width={1536} height={1024} fetchPriority="high" alt="Developer building apps at a desk" /></div>
}

function Swoosh({ className }: { className: string }) {
  return <svg className={className} viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true"><path d="M3 15 C 70 7, 190 3, 297 6 C 296 8, 296 9, 294 10 C 190 9, 80 13, 6 20 C 3 19, 2 17, 3 15 Z" /></svg>
}

const heroPillars = [
  { label: 'Build', icon: Code2 },
  { label: 'Learn', icon: GraduationCap },
  { label: 'Improve', icon: ChartNoAxesColumnIncreasing },
  { label: 'Repeat', icon: RefreshCw },
]

const homeLinks = [
  { to: '/apps', label: 'apps', title: 'Explore my apps', description: 'Useful tools for everyday life.', icon: Smartphone },
  { to: '/websites', label: 'websites', title: 'See web projects', description: 'Ideas turned into real products.', icon: Globe2 },
  { to: '/about', label: 'about', title: 'Meet the maker', description: 'My journey, skills and interests.', icon: UserRound },
  { to: '/problem', label: 'problem', title: 'Share a problem', description: 'Real problems lead to better solutions.', icon: MessageSquareWarning },
  { to: '/demand', label: 'demand', title: 'Request an idea', description: 'Have an idea? Let’s build it together.', icon: Lightbulb },
]

function HomePage() {
  return <><section className="hero-panel home-hero" aria-labelledby="page-title"><div className="hero-copy">
    <p className="eyebrow hero-eyebrow">Home</p>
    <p className="hand-label">Hey, I’m <svg className="hand-marks" viewBox="0 0 26 18" aria-hidden="true"><path d="M3 15 L9 5 M12 16 L23 9" /></svg></p>
    <h1 id="page-title">Rahul Kumar</h1>
    <Swoosh className="name-swoosh" />
    <p className="hero-intro">I build apps, websites and little ideas that make life easier.</p>
    <ul className="hero-pillars">{heroPillars.map(({ label, icon: Icon }) => <li key={label}><Icon size={17} /> {label}</li>)}</ul>
    <div className="hero-actions"><Link className="hero-button" to="/apps">Explore My Work <ArrowRight size={17} /></Link><p className="hero-quote">Small tools.<br />Big impact.<Swoosh className="quote-swoosh" /></p></div>
  </div><HeroArt /></section>
  <nav className="home-links" aria-label="Explore">{homeLinks.map(({ to, label, title, description, icon: Icon }) => <Link key={to} to={to}><span className="home-link-label"><Icon size={18} /> // {label}</span><strong>{title}</strong><span className="home-link-description">{description}</span><span className="home-link-arrow"><ArrowRight size={16} /></span></Link>)}</nav></>
}

function AppsPage() {
  return <section className="standalone-panel apps-panel apps-page" aria-labelledby="apps-title">
    <header className="apps-hero"><p className="eyebrow">// apps</p><h1 id="apps-title">Mobile <em>Apps</em></h1><p>Simple. Useful. Made with <b>♥</b><br />Download and try my Android apps.</p></header>
    <AppsHeroArt />
    <div className="app-grid">{apps.map((app) => <AppCard key={app.name} app={app} />)}<MoreSoonCard /></div>
  </section>
}

function WebsitesPage() {
  return <section className="standalone-panel websites-page-panel websites-panel" aria-labelledby="websites-title"><p className="eyebrow">// websites</p><div className="section-title-row"><div><h1 id="websites-title">Web Projects</h1><div className="green-underline" /></div><p>A collection of websites I’ve built.<br />Click to explore and check them out.</p><span className="live-note">Live &amp; running ↗</span></div><WebsitesGrid /></section>
}

function AboutPage() {
  return <section className="standalone-panel about-page-panel about-panel" aria-labelledby="about-title"><p className="eyebrow">// about</p><h1 id="about-title">About Me</h1><div className="green-underline" /><p>I’m Rahul Kumar, a developer who loves turning ideas into real products. I enjoy building mobile apps, web apps and exploring new technologies.</p><ul><li><Code2 size={18} /> Build useful products</li><li><span className="book-icon">▤</span> Always learning</li><li><UserRound size={18} /> Open to collaboration</li><li><Coffee size={18} /> Powered by coffee</li></ul><p className="about-note">Let’s build something<br />cool together! <ArrowRight size={18} /></p><div className="about-callout"><span>Currently thinking about</span><strong>Small tools, useful products,<br />and a better internet together.</strong></div></section>
}

function RequestPage({ type }: { type: 'problem' | 'demand' }) {
  const isProblem = type === 'problem'
  const [submitted, setSubmitted] = useState(false)
  const [items, setItems] = useState<PublicRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const isAdmin = useAdminSession() !== null

  useEffect(() => {
    setLoading(true)
    listRequests(type).then(setItems).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false))
  }, [type, isAdmin])

  async function handleDelete(item: PublicRequest) {
    if (!window.confirm(`Delete this ${type}? This cannot be undone.`)) return
    setError('')
    setDeletingId(item.id)
    try {
      await deleteRequest(type, item.id)
      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be deleted.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await createRequest({ kind: type, name: String(form.get('name') || ''), description: String(form.get('problem') || ''), requirements: String(form.get('requirements') || ''), productType: String(form.get('productType') || ''), email: String(form.get('email') || '') })
      setItems((currentItems) => [result.item, ...currentItems])
      setSubmitted(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The request could not be submitted.')
    }
  }

  return <section className={`standalone-panel request-page ${isProblem ? 'problem-page' : 'demand-page'}`} aria-labelledby={`${type}-title`}>
    <div className="request-intro"><p className="eyebrow">// {type}</p><h1 id={`${type}-title`}>{isProblem ? 'Share a Problem' : 'Request an Idea'}</h1><p>{isProblem ? 'Tell me about a problem you are facing. Maybe it can become a small, useful product.' : 'Have an app or website in mind? Share the requirement and let’s shape it into something useful.'}</p></div>
    {submitted ? <div className="request-success"><CheckCircle2 size={42} /><h2>Thanks for sharing.</h2><p>Your {isProblem ? 'problem' : 'requirement'} is noted. I’ll take a look and think about the next step.</p><button type="button" onClick={() => setSubmitted(false)}>Submit another</button></div> : <form className="request-form" onSubmit={handleSubmit}>
      {isProblem ? <label>What problem are you facing?<textarea name="problem" placeholder="Describe the problem in your own words..." required /></label> : <><label>What should I build?<input name="name" placeholder="App or website name (optional)" /></label><label>What do you need?<textarea name="requirements" placeholder="Describe the features or requirements..." required /></label><label>Product type<select name="productType" defaultValue="app"><option value="app">Mobile app</option><option value="website">Website</option><option value="both">App and website</option></select></label></>}
      <label>Your email <span className="optional">optional</span><input type="email" name="email" placeholder="you@example.com" /></label>
      <button className="request-submit" type="submit">{isProblem ? 'Submit Problem' : 'Send Requirement'} <ArrowRight size={16} /></button>
    </form>}
    {error && <p className="request-error" role="alert">{error}</p>}
    <div className="public-requests"><div className="public-requests-heading"><p className="eyebrow">// community</p><span>{loading ? 'Loading...' : `${items.length} shared`}</span></div>{!loading && items.length === 0 && <p className="empty-requests">Nothing shared yet. You could be the first.</p>}{items.map((item) => <article className="public-request" key={item.id}><time>{new Date(item.createdAt).toLocaleDateString()}</time><strong>{isProblem ? 'Problem shared' : item.name || 'New product idea'}</strong><p>{isProblem ? item.description : item.requirements}</p>{!isProblem && item.productType && <span>{item.productType}</span>}{isAdmin && <div className="admin-item-tools">{item.email ? <a href={`mailto:${item.email}`}><Mail size={12} /> {item.email}</a> : <em>No email</em>}<button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} aria-label={`Delete this ${type}`}><Trash2 size={13} /> {deletingId === item.id ? 'Deleting…' : 'Delete'}</button></div>}</article>)}</div>
  </section>
}

function AdminPage() {
  const session = useAdminSession()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await adminLogin(String(new FormData(event.currentTarget).get('password') || ''))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="standalone-panel request-page admin-page" aria-labelledby="admin-title">
    <div className="request-intro"><p className="eyebrow">// admin</p><h1 id="admin-title">Admin</h1><p>{session ? 'You are logged in. Delete buttons and submitter emails now appear on the Problem and Demand pages, and you can reply to and manage feedback.' : 'Log in to manage problems, demands and feedback.'}</p></div>
    {session ? <div className="request-success admin-panel"><ShieldCheck size={42} /><h2>Admin user</h2><p>Session active until {new Date(session.expiresAt).toLocaleString()}.</p><div className="admin-links"><Link to="/problem">Manage problems <ArrowRight size={14} /></Link><Link to="/demand">Manage demands <ArrowRight size={14} /></Link><Link to="/suggest">Manage feedback <ArrowRight size={14} /></Link></div><button type="button" onClick={clearAdminSession}><LogOut size={15} /> Log out</button></div> : <form className="request-form" onSubmit={handleLogin}>
      <label>Admin password<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
      <button className="request-submit" type="submit" disabled={submitting}>{submitting ? 'Checking…' : 'Log in'} <ArrowRight size={16} /></button>
    </form>}
    {error && <p className="request-error" role="alert">{error}</p>}
  </section>
}

function App() {
  return <BrowserRouter><Shell><Routes><Route path="/" element={<HomePage />} /><Route path="/apps" element={<AppsPage />} /><Route path="/websites" element={<WebsitesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/problem" element={<RequestPage type="problem" />} /><Route path="/demand" element={<RequestPage type="demand" />} /><Route path="/admin" element={<AdminPage />} /><Route path="/suggest" element={<FeedbackPickerPage />} /><Route path="/suggest/:slug/:id?" element={<FeedbackRoute />} /></Routes></Shell></BrowserRouter>
}

export default App
