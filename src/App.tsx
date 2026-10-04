import { ArrowDown, ArrowRight, CheckCircle2, Code2, Coffee, Download, ExternalLink, Globe2, History, Home, Lightbulb, LogOut, Mail, Menu, MessageSquareWarning, Moon, ShieldCheck, Smartphone, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import heroImage from './assets/hero.webp'
import heroImageSmall from './assets/hero-768.webp'
import { clearAdminSession, useAdminSession } from './lib/admin'
import { adminLogin, createRequest, deleteRequest, listRequests, type PublicRequest } from './lib/api'
import projects from './data/projects.json'
import { useFileLastUpdated } from './lib/github'

type AppProject = { name: string; description: string; version: string; downloads?: string; size?: string; accent: string; initials: string; icon?: string; apkUrl: string }
type WebsiteProject = { name: string; description: string; tone: string }
const apps: AppProject[] = projects.apps
const websites: WebsiteProject[] = projects.websites
const appIcons = import.meta.glob<string>('./assets/app-icons/*', { eager: true, query: '?url', import: 'default' })

// GitHub "blob" links open a preview page; "raw" redirects to the actual file, which browsers download.
function getApkUrl(url: string) { return url.replace('/blob/', '/raw/') }

const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' })
const formatUpdatedDate = (date: Date) => `${date.getDate()} ${shortMonth.format(date)} ${date.getFullYear()}`

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
function formatTimeAgo(date: Date, now: number) {
  const seconds = Math.round((now - date.getTime()) / 1000)
  for (const [unit, unitSeconds] of relativeUnits) if (seconds >= unitSeconds) return relativeTime.format(-Math.floor(seconds / unitSeconds), unit)
  return 'just now'
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(timer) }, [intervalMs])
  return now
}

function AppUpdated({ apkUrl }: { apkUrl: string }) {
  const updated = useFileLastUpdated(apkUrl)
  const now = useNow(60_000)
  if (updated.status === 'ready') return <p className="app-updated"><History size={12} /> Updated <time dateTime={updated.date.toISOString()} title={updated.date.toLocaleString()}>{formatUpdatedDate(updated.date)}</time> <span className="time-ago">({formatTimeAgo(updated.date, now)})</span></p>
  if (updated.status === 'error') return <p className="app-updated"><a href={apkUrl} target="_blank" rel="noreferrer">View release on GitHub <ExternalLink size={11} /></a></p>
  return <p className="app-updated is-loading"><History size={12} /> Checking GitHub…</p>
}

function AppCard({ app }: { app: AppProject }) {
  const iconUrl = app.icon ? appIcons[`./assets/app-icons/${app.icon}`] : undefined
  return <article className="app-card" style={{ '--app-accent': app.accent } as React.CSSProperties}>
    <div className={`app-icon${iconUrl ? ' has-image' : ''}`}>{iconUrl ? <img src={iconUrl} alt="" width={45} height={45} loading="lazy" /> : <span>{app.initials}</span>}<i>✓</i></div><h3>{app.name}</h3><p>{app.description}</p>
    <div className="app-meta"><span>v{app.version}</span><span>{app.downloads ? `${app.downloads} downloads` : 'New'}</span>{app.size && <span>{app.size}</span>}</div>
    <AppUpdated apkUrl={app.apkUrl} />
    <a className="download-button" href={getApkUrl(app.apkUrl)} download rel="noreferrer" aria-label={`Download ${app.name} APK${app.size ? ` (${app.size})` : ''}`}><Download size={14} /> Download APK</a>
  </article>
}

function WebsitesGrid() {
  return <div className="website-grid">{websites.map((site) => <a className="website-card" href="https://github.com/iamrahul25" target="_blank" rel="noreferrer" key={site.name}>
    <div className={`site-preview ${site.tone}`}><span>{site.name.slice(0, 2).toUpperCase()}</span></div><div className="website-copy"><strong>{site.name}</strong><ExternalLink size={15} /><p>{site.description}</p></div>
  </a>)}</div>
}

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/apps', label: 'Apps', icon: Smartphone },
  { to: '/websites', label: 'Websites', icon: Globe2 },
  { to: '/about', label: 'About', icon: UserRound },
  { to: '/problem', label: 'Problem', icon: MessageSquareWarning },
  { to: '/demand', label: 'Demand', icon: Lightbulb },
]

function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileNavRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const isAdmin = useAdminSession() !== null

  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [pathname])

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
    </nav>{isAdmin && <Link className="admin-badge" to="/admin" title="Logged in as admin"><ShieldCheck size={14} /> Admin</Link>}<div className="sidebar-footer"><span><Moon size={15} /> Dark mode</span><span className="build-note">Build<br />Ideas<br />Ship<br />Repeat <ArrowRight size={14} /></span></div></aside>
    <nav className="mobile-topbar" aria-label="Mobile navigation" ref={mobileNavRef}><Link className="wordmark" to="/">RK<span>.</span></Link><button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className={`mobile-menu${menuOpen ? ' open' : ''}`} id="mobile-menu">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}><Icon size={16} /> {label}</NavLink>)}{isAdmin && <NavLink className="mobile-admin-link" to="/admin" onClick={() => setMenuOpen(false)}><ShieldCheck size={16} /> Admin</NavLink>}</div></nav>
    <div className="dashboard" key={pathname}>{children}</div>
  </main>
}

function HeroArt() {
  return <div className="hero-art"><img src={heroImage} srcSet={`${heroImageSmall} 768w, ${heroImage} 1536w`} sizes="(max-width: 760px) 100vw, 60vw" width={1536} height={1024} fetchPriority="high" alt="Developer building apps at a desk" /></div>
}

const homeLinks = [
  { to: '/apps', label: 'apps', title: 'Explore my apps' },
  { to: '/websites', label: 'websites', title: 'See web projects' },
  { to: '/about', label: 'about', title: 'Meet the maker' },
  { to: '/problem', label: 'problem', title: 'Share a problem' },
  { to: '/demand', label: 'demand', title: 'Request an idea' },
]

function HomePage() {
  return <><section className="hero-panel home-hero" aria-labelledby="page-title"><div className="hero-copy"><p className="eyebrow">Home</p><p className="hand-label">Hey, I’m</p><h1 id="page-title">Rahul Kumar</h1><div className="marker-line" /><p className="hero-intro">I build apps, websites <br />and little ideas that <br />make life easier.</p><Link className="hero-button" to="/apps">Explore My Work <ArrowRight size={16} /></Link><p className="hero-quote">“Small tools. Big impact.”</p></div><HeroArt /></section><section className="home-links">{homeLinks.map(({ to, label, title }) => <Link key={to} to={to}><span>// {label}</span><strong>{title} <ArrowRight size={16} /></strong></Link>)}</section></>
}

function AppsPage() {
  return <section className="standalone-panel apps-page-panel apps-panel" aria-labelledby="apps-title"><div className="page-heading dark-heading"><div><p className="eyebrow">// apps</p><h1 id="apps-title">Mobile Apps</h1><p>Simple. Useful. Made with <b>♥</b><br />Download and try my Android apps.</p></div><span className="panel-doodle">Tools in your pocket<br /><ArrowDown size={18} /></span></div><div className="app-grid">{apps.map((app) => <AppCard key={app.name} app={app} />)}<article className="app-card placeholder-card"><div className="app-icon"><span>+</span></div><h3>More soon</h3><p>There are a few more ideas taking shape.</p><div className="app-meta"><span>in progress</span></div></article></div></section>
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
    <div className="request-intro"><p className="eyebrow">// admin</p><h1 id="admin-title">Admin</h1><p>{session ? 'You are logged in. Delete buttons and submitter emails now appear on the Problem and Demand pages.' : 'Log in to manage problems and demands.'}</p></div>
    {session ? <div className="request-success admin-panel"><ShieldCheck size={42} /><h2>Admin user</h2><p>Session active until {new Date(session.expiresAt).toLocaleString()}.</p><div className="admin-links"><Link to="/problem">Manage problems <ArrowRight size={14} /></Link><Link to="/demand">Manage demands <ArrowRight size={14} /></Link></div><button type="button" onClick={clearAdminSession}><LogOut size={15} /> Log out</button></div> : <form className="request-form" onSubmit={handleLogin}>
      <label>Admin password<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
      <button className="request-submit" type="submit" disabled={submitting}>{submitting ? 'Checking…' : 'Log in'} <ArrowRight size={16} /></button>
    </form>}
    {error && <p className="request-error" role="alert">{error}</p>}
  </section>
}

function App() {
  return <BrowserRouter><Shell><Routes><Route path="/" element={<HomePage />} /><Route path="/apps" element={<AppsPage />} /><Route path="/websites" element={<WebsitesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/problem" element={<RequestPage type="problem" />} /><Route path="/demand" element={<RequestPage type="demand" />} /><Route path="/admin" element={<AdminPage />} /></Routes></Shell></BrowserRouter>
}

export default App
