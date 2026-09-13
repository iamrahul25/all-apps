import type { CSSProperties } from 'react'
import { Download, ExternalLink, GitBranch, Sparkles } from 'lucide-react'

type Project = {
  name: string
  type: 'app' | 'website'
  description: string
  url: string
  accent: string
  initials: string
}

const projects: Project[] = [
  {
    name: 'Use-it',
    type: 'app',
    description: 'An expiry item notifier that helps everyday things get used in time.',
    url: 'https://github.com/iamrahul25/useit/blob/master/builds/useit-v1.0.0-release.apk',
    accent: '#f3a712',
    initials: 'UI',
  },
  {
    name: 'Habit-app',
    type: 'app',
    description: 'A focused habit maker and notifier for building a rhythm that sticks.',
    url: 'https://github.com/iamrahul25/habit-app/blob/master/build-apk/app-release.apk',
    accent: '#e56b6f',
    initials: 'HA',
  },
]

function getProjectUrl(project: Project) {
  if (project.type !== 'app') return project.url
  return project.url.replace('github.com/', 'github.com/').replace('/blob/', '/raw/')
}

function ProjectCard({ project }: { project: Project }) {
  const isApp = project.type === 'app'

  return (
    <article className="project-card" style={{ '--accent': project.accent } as CSSProperties}>
      <div className="project-mark" aria-hidden="true">{project.initials}</div>
      <div className="card-copy">
        <div className="card-meta">
          <span className="project-type">{isApp ? 'Android app' : 'Website'}</span>
          <span className="project-index">{String(projects.indexOf(project) + 1).padStart(2, '0')}</span>
        </div>
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        <a
          className="project-action"
          href={getProjectUrl(project)}
          target={isApp ? undefined : '_blank'}
          rel={isApp ? undefined : 'noreferrer'}
          download={isApp ? true : undefined}
        >
          {isApp ? <Download size={17} strokeWidth={2.2} /> : <ExternalLink size={17} strokeWidth={2.2} />}
          <span>{isApp ? 'Download APK' : 'Visit website'}</span>
        </a>
      </div>
    </article>
  )
}

function App() {
  const appCount = projects.filter((project) => project.type === 'app').length
  const websiteCount = projects.filter((project) => project.type === 'website').length

  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="/">R<span>.</span></a>
        <div className="nav-right">
          <span className="nav-note">Selected work / 2026</span>
          <a className="github-link" href="https://github.com/iamrahul25" target="_blank" rel="noreferrer" aria-label="Open GitHub profile">
            <GitBranch size={19} />
          </a>
        </div>
      </nav>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-kicker"><Sparkles size={15} /> A small shelf of useful things</div>
        <h1 id="page-title">Ideas, made<br /><em>usable.</em></h1>
        <p className="hero-intro">A living collection of websites and apps by Rahul. Browse around, or take something useful with you.</p>
        <div className="hero-aside" aria-label="Collection summary">
          <span className="aside-rule" />
          <span>{projects.length} projects<br />{websiteCount} websites / {appCount} apps</span>
        </div>
      </section>

      <section className="collection" aria-labelledby="collection-title">
        <div className="section-heading">
          <p className="section-label">The collection</p>
          <h2 id="collection-title">Things I’ve been<br /><em>working on.</em></h2>
        </div>
        <div className="project-grid">
          {projects.map((project) => <ProjectCard key={project.name} project={project} />)}
        </div>
      </section>

      <footer>
        <span>More in progress.</span>
        <span className="footer-line" />
        <span>Made with curiosity.</span>
      </footer>
    </main>
  )
}

export default App