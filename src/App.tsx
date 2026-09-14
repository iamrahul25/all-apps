import { ArrowDown, ArrowRight, CheckCircle2, Code2, Coffee, Download, ExternalLink, Globe2, Home, Lightbulb, Menu, MessageSquareWarning, Moon, Smartphone, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import heroImage from '../UI-design/img/image.png'
import { createRequest, listRequests, type PublicRequest } from './lib/api'

type AppProject = { name: string; description: string; version: string; downloads: string; accent: string; initials: string; apkUrl: string }
const apps: AppProject[] = [
  { name: 'Use-it', description: 'Use everyday things before they expire.', version: '1.0.0', downloads: '2K+', accent: '#8371f4', initials: 'UI', apkUrl: 'https://github.com/iamrahul25/useit/blob/master/builds/useit-v1.0.0-release.apk' },
  { name: 'Habit-app', description: 'Build a rhythm that sticks, one day at a time.', version: '1.0.0', downloads: '10K+', accent: '#ff736e', initials: 'HA', apkUrl: 'https://github.com/iamrahul25/habit-app/blob/master/build-apk/app-release.apk' },
]
const websites = [
  { name: 'Taskflow', description: 'A simple task management web app to stay productive.', tone: 'blue' },
  { name: 'ImageKit Pro', description: 'Free online tools for image editing and conversion.', tone: 'pink' },
  { name: 'LinkHub', description: 'A beautiful link in bio page for creators.', tone: 'violet' },
  { name: 'WeatherNow', description: 'Real-time weather information in a clean UI.', tone: 'sky' },
  { name: 'QuoteDaily', description: 'Daily motivation for a better you.', tone: 'lilac' },
  { name: 'DevUtils', description: 'Handy tools for developers.', tone: 'dark' },
]

function getApkUrl(url: string) { return url.replace('/blob/', '/raw/') }

function AppCard({ app }: { app: AppProject }) {
  return <article className="app-card" style={{ '--app-accent': app.accent } as React.CSSProperties}>
    <div className="app-icon"><span>{app.initials}</span><i>✓</i></div><h3>{app.name}</h3><p>{app.description}</p>
    <div className="app-meta"><span>v{app.version}</span><span>{app.downloads} downloads</span></div>
    <a className="download-button" href={getApkUrl(app.apkUrl)} download target="_blank" rel="noreferrer"><Download size={14} /> Download APK</a>
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
  return <main>
    <aside className="sidebar"><Link className="wordmark" to="/">RK<span>.</span></Link><nav className="side-nav" aria-label="Primary navigation">
      {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={16} /> {label}</NavLink>)}
    </nav><div className="sidebar-footer"><span><Moon size={15} /> Dark mode</span><span className="build-note">Build<br />Ideas<br />Ship<br />Repeat <ArrowRight size={14} /></span></div></aside>
    <nav className="mobile-topbar" aria-label="Mobile navigation"><Link className="wordmark" to="/">RK<span>.</span></Link><button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>{menuOpen && <div className="mobile-menu">{navItems.map(({ to, label }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}</div>}</nav>
    <div className="dashboard">{children}</div>
  </main>
}

function HeroArt() {
  return <div className="hero-art"><img src={heroImage} alt="Developer building apps at a desk" /></div>
}

function HomePage() {
  return <><section className="hero-panel home-hero" aria-labelledby="page-title"><div className="hero-copy"><p className="eyebrow">Home</p><p className="hand-label">Hey, I’m</p><h1 id="page-title">Rahul Kumar</h1><div className="marker-line" /><p className="hero-intro">I build apps, websites<br />and little ideas that<br />make life easier.</p><Link className="hero-button" to="/apps">Explore My Work <ArrowRight size={16} /></Link><p className="hero-quote">“Small tools. Big impact.”</p></div><HeroArt /></section><section className="home-links"><Link to="/apps"><span>// apps</span><strong>Explore mobile apps <ArrowRight size={16} /></strong></Link><Link to="/websites"><span>// websites</span><strong>See web projects <ArrowRight size={16} /></strong></Link><Link to="/about"><span>// about</span><strong>Meet the maker <ArrowRight size={16} /></strong></Link></section></>
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

  useEffect(() => {
    setLoading(true)
    listRequests(type).then(setItems).catch((requestError: Error) => setError(requestError.message)).finally(() => setLoading(false))
  }, [type])

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
    <div className="public-requests"><div className="public-requests-heading"><p className="eyebrow">// community</p><span>{loading ? 'Loading...' : `${items.length} shared`}</span></div>{!loading && items.length === 0 && <p className="empty-requests">Nothing shared yet. You could be the first.</p>}{items.map((item) => <article className="public-request" key={item.id}><time>{new Date(item.createdAt).toLocaleDateString()}</time><strong>{isProblem ? 'Problem shared' : item.name || 'New product idea'}</strong><p>{isProblem ? item.description : item.requirements}</p>{!isProblem && item.productType && <span>{item.productType}</span>}</article>)}</div>
  </section>
}

function App() {
  return <BrowserRouter><Shell><Routes><Route path="/" element={<HomePage />} /><Route path="/apps" element={<AppsPage />} /><Route path="/websites" element={<WebsitesPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/problem" element={<RequestPage type="problem" />} /><Route path="/demand" element={<RequestPage type="demand" />} /></Routes></Shell></BrowserRouter>
}

export default App
