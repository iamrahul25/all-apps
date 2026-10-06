import { Activity, ArrowBigUp, ArrowLeft, Bug, CalendarDays, Check, CheckCircle2, CircleHelp, Copy, Lightbulb, Link2, Mail, MessageCircle, MessageSquare, Plus, Search, Send, Trash2, TrendingUp, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAdminSession } from '../lib/admin'
import {
  FEEDBACK_PRIORITIES, FEEDBACK_STATUSES, FEEDBACK_TYPES, addFeedbackComment, createFeedback, deleteFeedback, deleteFeedbackComment, feedbackProjects, findFeedbackProject,
  forgetFeedbackKey, formatFeedbackId, getFeedback, getFeedbackKey, getFeedbackSummary, listFeedback, ownedFeedbackIds, priorityLabels, saveFeedbackKey, statusLabels, trackingLink, typeLabels, updateFeedback, voteFeedback,
  type FeedbackActivity, type FeedbackCounts, type FeedbackDetail, type FeedbackItem, type FeedbackProject, type FeedbackSort, type FeedbackStatus, type FeedbackType, type FeedbackUpdate,
} from '../lib/feedback'
import { formatTimeAgo, useNow } from '../lib/time'
import '../feedback.css'

const typeIcons: Record<FeedbackType, typeof Bug> = { bug: Bug, suggestion: Lightbulb, improvement: TrendingUp, feedback: MessageSquare, question: CircleHelp }
const sortLabels: Record<FeedbackSort, string> = { newest: 'Newest', oldest: 'Oldest', votes: 'Most upvoted', comments: 'Most commented', updated: 'Recently updated' }
const activityFieldNames: Record<string, string> = { status: 'status', type: 'type', priority: 'priority', assignee: 'assignee', tags: 'tags' }
const fullDate = (value: string) => new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

function initialsOf(name: string | null) {
  const parts = (name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts.slice(0, 2).map(part => part[0]!.toUpperCase()).join('') : '?'
}

function ProjectIcon({ project, size = 44 }: { project: FeedbackProject; size?: number }) {
  return <span className={`fb-project-icon${project.iconUrl ? ' has-image' : ''}`} style={{ width: size, height: size, '--project-accent': project.accent } as React.CSSProperties}>
    {project.iconUrl ? <img src={project.iconUrl} alt="" width={size} height={size} /> : project.initials}
  </span>
}

function TypeBadge({ type }: { type: FeedbackType }) {
  const Icon = typeIcons[type] ?? MessageSquare
  return <span className={`fb-badge fb-type-${type}`}><Icon size={13} /> {typeLabels[type] ?? type}</span>
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return <span className={`fb-badge fb-status fb-status-${status}`}>{statusLabels[status] ?? status}</span>
}

function PriorityBadge({ priority }: { priority: FeedbackItem['priority'] }) {
  return priority ? <span className={`fb-badge fb-priority-${priority}`}>{priorityLabels[priority]}</span> : <span className="fb-muted">Not set</span>
}

function Avatar({ name, role }: { name: string | null; role?: 'admin' | 'submitter' }) {
  return <span className={`fb-avatar${role === 'admin' ? ' is-admin' : ''}`} aria-hidden="true">{role === 'admin' ? 'RK' : initialsOf(name)}</span>
}

function CopyButton({ text, label, className = 'fb-icon-button' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(timer) }, [copied])
  return <button type="button" className={className} title={label} aria-label={label} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}>
    {copied ? <Check size={15} /> : <Copy size={15} />}{className !== 'fb-icon-button' && (copied ? ' Copied' : ` ${label}`)}
  </button>
}

// ---------------------------------------------------------------------------
// /suggest — app picker
// ---------------------------------------------------------------------------

export function FeedbackPickerPage({ missingSlug }: { missingSlug?: string }) {
  const [summary, setSummary] = useState<Record<string, { total: number; open: number }>>({})
  useEffect(() => { getFeedbackSummary().then(setSummary).catch(() => setSummary({})) }, [])

  const group = (kind: FeedbackProject['kind']) => feedbackProjects.filter(project => project.kind === kind).map(project => {
    const counts = summary[project.slug]
    return <Link key={project.slug} className="fb-picker-card" to={`/suggest/${project.slug}`}>
      <ProjectIcon project={project} />
      <span className="fb-picker-copy"><strong>{project.name}</strong><span>{project.description}</span></span>
      <span className="fb-picker-count">{counts ? <><b>{counts.open}</b> open · {counts.total} total</> : 'No feedback yet'}</span>
    </Link>
  })

  return <section className="standalone-panel fb-picker" aria-labelledby="feedback-title">
    <header className="fb-picker-head"><p className="eyebrow">// feedback</p><h1 id="feedback-title">Feedback</h1><p>Pick an app or website to report a bug, suggest a feature or ask a question. You can track your request and talk with the developer.</p></header>
    {missingSlug && <p className="fb-notice" role="alert">There is no app or website called “{missingSlug}”. Pick one below.</p>}
    <h2 className="fb-picker-group">Apps</h2><div className="fb-picker-grid">{group('app')}</div>
    <h2 className="fb-picker-group">Websites</h2><div className="fb-picker-grid">{group('website')}</div>
  </section>
}

// ---------------------------------------------------------------------------
// /suggest/:slug/:id? — board
// ---------------------------------------------------------------------------

export function FeedbackRoute() {
  const { slug, id } = useParams()
  const project = findFeedbackProject(slug)
  if (!project) return <FeedbackPickerPage missingSlug={slug} />
  const selectedId = id && /^\d+$/.test(id) ? Number(id) : null
  return <FeedbackBoard project={project} selectedId={selectedId} />
}

type TypeFilter = FeedbackType | 'all' | 'mine'

// Touch screens scroll the row natively; this adds click-and-drag scrolling for mouse and pen.
function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let startX = 0
    let startScroll = 0
    let pointerId: number | null = null
    let dragging = false

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0 || element.scrollWidth <= element.clientWidth) return
      pointerId = event.pointerId
      startX = event.clientX
      startScroll = element.scrollLeft
      dragging = false
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      const distance = event.clientX - startX
      if (!dragging && Math.abs(distance) < 5) return
      if (!dragging) {
        dragging = true
        element.setPointerCapture(event.pointerId)
        element.classList.add('is-dragging')
      }
      element.scrollLeft = startScroll - distance
    }
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      if (!dragging) return
      element.classList.remove('is-dragging')
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
      // A drag ends with a click on whichever chip is under the pointer; swallow it.
      element.addEventListener('click', swallowClick, { capture: true, once: true })
      setTimeout(() => element.removeEventListener('click', swallowClick, { capture: true }), 0)
    }
    const swallowClick = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation() }

    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    return () => {
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
    }
  }, [])
  return ref
}

function FeedbackBoard({ project, selectedId }: { project: FeedbackProject; selectedId: number | null }) {
  const isAdmin = useAdminSession() !== null
  const navigate = useNavigate()
  const now = useNow(60_000)
  const searchRef = useRef<HTMLInputElement>(null)
  const chipsRef = useDragScroll<HTMLDivElement>()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<FeedbackStatus | 'open' | ''>('')
  const [sort, setSort] = useState<FeedbackSort>('newest')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [counts, setCounts] = useState<FeedbackCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer) }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    listFeedback({
      app: project.slug,
      type: typeFilter !== 'all' && typeFilter !== 'mine' ? typeFilter : undefined,
      ids: typeFilter === 'mine' ? ownedFeedbackIds() : undefined,
      status: status || undefined,
      sort,
      q: query || undefined,
    })
      .then(result => { if (!cancelled) { setItems(result.items); setCounts(result.counts) } })
      .catch((requestError: Error) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.slug, typeFilter, status, sort, query, reloadKey, isAdmin])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || target.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const boardPath = `/suggest/${project.slug}`
  const closePanel = () => navigate(boardPath)
  const replaceItem = (next: FeedbackItem) => setItems(current => current.map(item => item.id === next.id ? next : item))
  const removeItem = (id: number) => { setItems(current => current.filter(item => item.id !== id)); setReloadKey(key => key + 1); closePanel() }
  const filtersActive = typeFilter !== 'all' || status !== '' || query !== ''
  const ownedIds = new Set(ownedFeedbackIds())

  const chips: { value: TypeFilter; label: string; icon?: typeof Bug }[] = [
    { value: 'all', label: 'All' },
    ...FEEDBACK_TYPES.map(type => ({ value: type, label: typeLabels[type], icon: typeIcons[type] })),
    { value: 'mine', label: 'My feedback', icon: UserRound },
  ]

  return <section className={`standalone-panel fb-page${selectedId ? ' has-panel' : ''}`} aria-labelledby="feedback-board-title">
    <div className="fb-main">
      <Link className="fb-back" to="/suggest"><ArrowLeft size={14} /> All apps</Link>
      <header className="fb-header">
        <div className="fb-title"><ProjectIcon project={project} size={48} /><div><h1 id="feedback-board-title">{project.name} Feedback</h1><p>Report bugs, suggest features and ask questions. The developer replies right here.</p></div></div>
        <div className="fb-header-actions">
          <label className="fb-search"><Search size={16} /><input ref={searchRef} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search feedback..." aria-label="Search feedback" /><kbd>/</kbd></label>
          <button type="button" className="fb-primary" onClick={() => setFormOpen(true)}><Plus size={17} /> New Feedback</button>
        </div>
      </header>

      <div className="fb-filters">
        <div className="fb-chips" ref={chipsRef} role="group" aria-label="Filter by type">
          {chips.map(({ value, label, icon: Icon }) => <button key={value} type="button" className={`fb-chip fb-chip-${value}${typeFilter === value ? ' active' : ''}`} aria-pressed={typeFilter === value} onClick={event => { setTypeFilter(value); event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) }}>
            {Icon && <Icon size={14} />} {label}{value !== 'mine' && <span className="fb-chip-count">{counts[value] ?? 0}</span>}
          </button>)}
        </div>
        <div className="fb-selects">
          <select value={status} onChange={event => setStatus(event.target.value as FeedbackStatus | 'open' | '')} aria-label="Filter by status">
            <option value="">All statuses</option><option value="open">Open</option>
            {FEEDBACK_STATUSES.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value as FeedbackSort)} aria-label="Sort feedback">
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="fb-error" role="alert">{error}</p>}

      <div className={`fb-list${loading ? ' is-loading' : ''}`} aria-busy={loading}>
        <div className="fb-row fb-row-head" aria-hidden="true"><span>Title</span><span>Type</span><span>Status</span><span>Author</span><span>Votes</span><span>Comments</span><span>Created</span></div>
        {items.map(item => <Link key={item.id} to={`${boardPath}/${item.id}`} className={`fb-row${item.id === selectedId ? ' selected' : ''}`} aria-current={item.id === selectedId ? 'true' : undefined}>
          <span className="fb-cell-title"><strong>{item.title}</strong><span>{item.description}</span></span>
          <span className="fb-cell-type"><TypeBadge type={item.type} /></span>
          <span className="fb-cell-status"><StatusBadge status={item.status} /></span>
          <span className="fb-cell-author"><Avatar name={item.authorName} /> {item.authorName || 'Anonymous'}{ownedIds.has(item.id) && <em className="fb-you">you</em>}</span>
          <span className={`fb-cell-votes${item.voted ? ' voted' : ''}`} title={`${item.upvotes} upvotes`}><ArrowBigUp size={16} /> {item.upvotes}</span>
          <span className="fb-cell-comments" title={`${item.commentCount} comments`}><MessageCircle size={15} /> {item.commentCount}</span>
          <span className="fb-cell-created"><time dateTime={item.createdAt} title={fullDate(item.createdAt)}>{formatTimeAgo(new Date(item.createdAt), now)}</time></span>
        </Link>)}
        {!loading && items.length === 0 && <div className="fb-empty">
          {typeFilter === 'mine' ? <p>You haven’t submitted feedback for {project.name} from this browser yet.</p> : filtersActive ? <p>Nothing matches these filters.</p> : <p>No feedback yet. Be the first to share something.</p>}
          <button type="button" className="fb-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> New Feedback</button>
        </div>}
      </div>
    </div>

    {selectedId && <FeedbackPanel key={selectedId} project={project} id={selectedId} isAdmin={isAdmin} now={now} onClose={closePanel} onItemChange={replaceItem} onDeleted={removeItem} />}
    {formOpen && <NewFeedbackDialog project={project} defaultType={typeFilter !== 'all' && typeFilter !== 'mine' ? typeFilter : 'bug'} onClose={() => setFormOpen(false)} onCreated={id => { setReloadKey(key => key + 1); navigate(`${boardPath}/${id}`) }} />}
  </section>
}

// ---------------------------------------------------------------------------
// New feedback dialog
// ---------------------------------------------------------------------------

function NewFeedbackDialog({ project, defaultType, onClose, onCreated }: { project: FeedbackProject; defaultType: FeedbackType; onClose: () => void; onCreated: (id: number) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [type, setType] = useState<FeedbackType>(defaultType)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ id: number; key: string } | null>(null)

  useEffect(() => { dialogRef.current?.showModal() }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) || '')
    try {
      const result = await createFeedback({ app: project.slug, type, title: field('title'), description: field('description'), name: field('name'), email: field('email'), trap: field('fb_trap') })
      setCreated({ id: result.item.id, key: result.key })
      onCreated(result.item.id)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Your feedback could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  return <dialog ref={dialogRef} className="fb-dialog" aria-labelledby="fb-dialog-title" onClose={onClose} onClick={event => { if (event.target === dialogRef.current) dialogRef.current.close() }}>
    <div className="fb-dialog-body">
      <header className="fb-dialog-head"><h2 id="fb-dialog-title">{created ? 'Feedback submitted' : `New feedback for ${project.name}`}</h2><button type="button" className="fb-icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={18} /></button></header>
      {created ? <div className="fb-created">
        <CheckCircle2 size={40} />
        <p>Thanks! Your tracking ID is <strong>{formatFeedbackId(created.id)}</strong>.</p>
        <p className="fb-muted">This browser remembers it, so you can follow progress and reply to the developer under <b>My feedback</b>. Save the private link below to keep access from another device.</p>
        <div className="fb-link-box"><code>{trackingLink(project.slug, created.id, created.key)}</code><CopyButton text={trackingLink(project.slug, created.id, created.key)} label="Copy link" className="fb-secondary" /></div>
        <button type="button" className="fb-primary" onClick={() => dialogRef.current?.close()}>View my feedback</button>
      </div> : <form className="fb-form" onSubmit={handleSubmit}>
        <fieldset className="fb-type-picker"><legend>What kind of feedback?</legend>
          {FEEDBACK_TYPES.map(value => { const Icon = typeIcons[value]; return <label key={value} className={`fb-type-option fb-type-${value}${type === value ? ' active' : ''}`}><input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} /><Icon size={16} /> {typeLabels[value]}</label> })}
        </fieldset>
        <label>Title<input name="title" maxLength={160} required placeholder={type === 'bug' ? 'e.g. App crashes on launch' : 'A short summary'} autoFocus /></label>
        <label>Description<textarea name="description" maxLength={4000} required placeholder={type === 'bug' ? 'What happened? What did you expect? Which device or browser?' : 'Tell us more...'} /></label>
        <div className="fb-form-row">
          <label>Your name <span className="optional">optional</span><input name="name" maxLength={80} placeholder="Shown publicly" autoComplete="name" /></label>
          <label>Email <span className="optional">optional</span><input name="email" type="email" maxLength={160} placeholder="Only the developer sees this" autoComplete="email" /></label>
        </div>
        <div className="fb-hp" aria-hidden="true"><input name="fb_trap" tabIndex={-1} autoComplete="off" /></div>
        {error && <p className="fb-error" role="alert">{error}</p>}
        <div className="fb-form-actions"><button type="button" className="fb-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button><button type="submit" className="fb-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit feedback'} <Send size={15} /></button></div>
      </form>}
    </div>
  </dialog>
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function describeActivity(entry: FeedbackActivity) {
  const format = (value: string | null) => {
    if (value === null) return 'none'
    if (entry.field === 'status') return statusLabels[value as FeedbackStatus] ?? value
    if (entry.field === 'type') return typeLabels[value as FeedbackType] ?? value
    if (entry.field === 'priority') return priorityLabels[value as keyof typeof priorityLabels] ?? value
    return value
  }
  if (entry.field === 'created') return <>submitted this as <b>{format(entry.to)}</b></>
  return <>changed {activityFieldNames[entry.field] ?? entry.field} from <b>{format(entry.from)}</b> to <b>{format(entry.to)}</b></>
}

type PanelProps = { project: FeedbackProject; id: number; isAdmin: boolean; now: number; onClose: () => void; onItemChange: (item: FeedbackItem) => void; onDeleted: (id: number) => void }

function FeedbackPanel({ project, id, isAdmin, now, onClose, onItemChange, onDeleted }: PanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [detail, setDetail] = useState<FeedbackDetail | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const key = searchParams.get('key')
    if (key) {
      saveFeedbackKey(id, key)
      setSearchParams(params => { params.delete('key'); return params }, { replace: true })
    }
    let cancelled = false
    getFeedback(id).then(result => {
      if (!result.isOwner && getFeedbackKey(id)) forgetFeedbackKey(id)
      if (!cancelled) setDetail(result)
    }).catch((requestError: Error) => { if (!cancelled) setError(requestError.message) })
    return () => { cancelled = true }
  }, [id, isAdmin])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function applyDetail(next: FeedbackDetail) {
    setDetail(next)
    onItemChange(next.item)
  }

  async function run(action: () => Promise<void>) {
    setError('')
    setBusy(true)
    try {
      await action()
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const update = (changes: FeedbackUpdate) => run(async () => applyDetail(await updateFeedback(id, changes)))

  const toggleVote = () => detail && run(async () => {
    const result = await voteFeedback(id, !detail.item.voted)
    applyDetail({ ...detail, item: { ...detail.item, upvotes: result.upvotes, voted: result.voted } })
  })

  const handleDelete = () => window.confirm(`Delete ${formatFeedbackId(id)}? This removes its comments and history too.`) && run(async () => { await deleteFeedback(id); onDeleted(id) })

  if (!detail) {
    return <aside className="fb-panel" aria-label="Feedback details">
      <div className="fb-panel-top"><span className="fb-panel-id">{formatFeedbackId(id)}</span><button type="button" className="fb-icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button></div>
      {error ? <p className="fb-error" role="alert">{error}</p> : <p className="fb-muted fb-panel-loading">Loading…</p>}
    </aside>
  }

  const { item, comments, activity, isOwner } = detail
  const publicLink = `${window.location.origin}/suggest/${project.slug}/${id}`
  const ownerKey = isOwner ? getFeedbackKey(id) : null

  return <aside className="fb-panel" aria-labelledby="fb-panel-title">
    <div className="fb-panel-top">
      <span className="fb-panel-id"><MessageSquare size={15} /> {formatFeedbackId(id)}</span>
      <span className="fb-panel-tools"><CopyButton text={publicLink} label="Copy link to this feedback" /><button type="button" className="fb-icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button></span>
    </div>

    <div className="fb-panel-scroll">
      <div className="fb-panel-heading"><h2 id="fb-panel-title">{item.title}</h2><StatusBadge status={item.status} /></div>
      <p className="fb-panel-description">{item.description}</p>
      <TagList tags={item.tags} editable={isAdmin} disabled={busy} onChange={tags => update({ tags })} />
      <div className="fb-panel-meta">
        <span><UserRound size={14} /> {item.authorName || 'Anonymous'}{isOwner && <em className="fb-you">you</em>}</span>
        <span><CalendarDays size={14} /> {fullDate(item.createdAt)}</span>
        <button type="button" className={`fb-vote${item.voted ? ' voted' : ''}`} onClick={toggleVote} disabled={busy} aria-pressed={item.voted} aria-label={item.voted ? 'Remove upvote' : 'Upvote'}><ArrowBigUp size={17} /> {item.upvotes}</button>
      </div>
      {isAdmin && <p className="fb-admin-email">{item.email ? <a href={`mailto:${item.email}`}><Mail size={13} /> {item.email}</a> : <em>No email given</em>}</p>}
      {ownerKey && <div className="fb-owner-note"><Link2 size={14} /> <span>You submitted this. Keep your private link to reply from another device.</span><CopyButton text={trackingLink(project.slug, id, ownerKey)} label="Copy private link" /></div>}

      <div className="fb-fields">
        <FieldControl label="Status" editable={isAdmin} display={<StatusBadge status={item.status} />}>
          <select value={item.status} disabled={busy} onChange={event => update({ status: event.target.value as FeedbackStatus })}>{FEEDBACK_STATUSES.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>
        </FieldControl>
        <FieldControl label="Type" editable={isAdmin} display={<TypeBadge type={item.type} />}>
          <select value={item.type} disabled={busy} onChange={event => update({ type: event.target.value as FeedbackType })}>{FEEDBACK_TYPES.map(value => <option key={value} value={value}>{typeLabels[value]}</option>)}</select>
        </FieldControl>
        <FieldControl label="Assignee" editable={isAdmin} display={item.assignee ? <span className="fb-assignee"><Avatar name={item.assignee} /> {item.assignee}</span> : <span className="fb-muted">Unassigned</span>}>
          <AssigneeInput value={item.assignee} disabled={busy} onSave={assignee => update({ assignee })} />
        </FieldControl>
        <FieldControl label="Priority" editable={isAdmin} display={<PriorityBadge priority={item.priority} />}>
          <select value={item.priority ?? ''} disabled={busy} onChange={event => update({ priority: (event.target.value || null) as FeedbackItem['priority'] })}><option value="">Not set</option>{FEEDBACK_PRIORITIES.map(value => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select>
        </FieldControl>
      </div>

      {error && <p className="fb-error" role="alert">{error}</p>}

      <div className="fb-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'comments'} className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>Comments <span className="fb-chip-count">{comments.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}><Activity size={14} /> Activity</button>
      </div>

      {tab === 'comments' ? <ul className="fb-comments">
        {comments.length === 0 && <li className="fb-muted">No comments yet.</li>}
        {comments.map(comment => <li key={comment.id} className={`fb-comment${comment.role === 'admin' ? ' is-admin' : ''}`}>
          <Avatar name={comment.authorName} role={comment.role} />
          <div>
            <p className="fb-comment-head"><strong>{comment.role === 'admin' ? 'Developer' : comment.authorName || 'Anonymous'}</strong>{comment.role === 'admin' ? <span className="fb-role">Developer</span> : <span className="fb-role is-submitter">Submitter</span>}<time dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>{formatTimeAgo(new Date(comment.createdAt), now)}</time></p>
            <p className="fb-comment-body">{comment.body}</p>
          </div>
          {isAdmin && <button type="button" className="fb-icon-button fb-danger" aria-label="Delete comment" disabled={busy} onClick={() => window.confirm('Delete this comment?') && run(async () => {
            await deleteFeedbackComment(id, comment.id)
            applyDetail({ ...detail, comments: comments.filter(current => current.id !== comment.id), item: { ...item, commentCount: Math.max(item.commentCount - 1, 0) } })
          })}><Trash2 size={14} /></button>}
        </li>)}
      </ul> : <ul className="fb-activity">
        {activity.map(entry => <li key={entry.id}><span className="fb-activity-dot" /><p><b>{entry.actor === 'admin' ? 'Developer' : item.authorName || 'Submitter'}</b> {describeActivity(entry)}</p><time dateTime={entry.createdAt} title={fullDate(entry.createdAt)}>{formatTimeAgo(new Date(entry.createdAt), now)}</time></li>)}
      </ul>}

      {isAdmin && <button type="button" className="fb-delete" onClick={handleDelete} disabled={busy}><Trash2 size={14} /> Delete feedback</button>}
    </div>

    {tab === 'comments' && (isAdmin || isOwner ? <CommentBox asAdmin={isAdmin} onSend={body => run(async () => {
      const comment = await addFeedbackComment(id, body)
      applyDetail({ ...detail, comments: [...comments, comment], item: { ...item, commentCount: item.commentCount + 1 } })
    })} /> : <ClaimAccess id={id} onClaimed={applyDetail} />)}
  </aside>
}

function trackingKeyFrom(input: string) {
  const value = input.trim()
  try { return new URL(value).searchParams.get('key') ?? '' } catch { return value }
}

function ClaimAccess({ id, onClaimed }: { id: number; onClaimed: (detail: FeedbackDetail) => void }) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function claim(event: React.FormEvent) {
    event.preventDefault()
    const key = trackingKeyFrom(link)
    if (!key) return setError('Paste the private link you got after submitting.')
    setError('')
    setChecking(true)
    saveFeedbackKey(id, key)
    try {
      const detail = await getFeedback(id)
      if (detail.isOwner) return onClaimed(detail)
      forgetFeedbackKey(id)
      setError(`That link doesn't belong to ${formatFeedbackId(id)}.`)
    } catch (requestError) {
      forgetFeedbackKey(id)
      setError(requestError instanceof Error ? requestError.message : 'The link could not be checked.')
    } finally {
      setChecking(false)
    }
  }

  return <div className="fb-comment-locked">
    <p>Only the person who submitted this and the developer can reply. Your browser remembers the items you submit from it.</p>
    {open ? <form className="fb-claim" onSubmit={claim}>
      <input value={link} onChange={event => setLink(event.target.value)} placeholder="Paste your private tracking link" aria-label="Private tracking link" autoFocus />
      <button type="submit" className="fb-secondary" disabled={checking}>{checking ? 'Checking…' : 'Unlock'}</button>
    </form> : <button type="button" className="fb-link-button" onClick={() => setOpen(true)}>Submitted this from another browser or device? Use your private link</button>}
    {error && <p className="fb-error" role="alert">{error}</p>}
  </div>
}

function FieldControl({ label, editable, display, children }: { label: string; editable: boolean; display: React.ReactNode; children: React.ReactNode }) {
  return <div className="fb-field">{editable ? <label>{label}{children}</label> : <><span className="fb-field-label">{label}</span><div className="fb-field-value">{display}</div></>}</div>
}

function AssigneeInput({ value, disabled, onSave }: { value: string | null; disabled: boolean; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const save = () => { const next = draft.trim() || null; if (next !== value) onSave(next) }
  return <input value={draft} disabled={disabled} maxLength={80} placeholder="Unassigned" onChange={event => setDraft(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save() } }} />
}

function TagList({ tags, editable, disabled, onChange }: { tags: string[]; editable: boolean; disabled: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  if (!editable && tags.length === 0) return null
  const add = () => {
    const tag = draft.trim().slice(0, 30)
    setDraft('')
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
  }
  return <ul className="fb-tags">
    {tags.map(tag => <li key={tag}>{tag}{editable && <button type="button" aria-label={`Remove tag ${tag}`} disabled={disabled} onClick={() => onChange(tags.filter(current => current !== tag))}><X size={11} /></button>}</li>)}
    {editable && tags.length < 10 && <li className="fb-tag-input"><input value={draft} disabled={disabled} placeholder="+ Add tag" aria-label="Add tag" onChange={event => setDraft(event.target.value)} onBlur={add} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() } }} /></li>}
  </ul>
}

function CommentBox({ asAdmin, onSend }: { asAdmin: boolean; onSend: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    if (await onSend(body.trim())) setBody('')
    setSending(false)
  }
  return <form className="fb-comment-box" onSubmit={submit}>
    <Avatar name={null} role={asAdmin ? 'admin' : 'submitter'} />
    <textarea value={body} maxLength={2000} rows={1} placeholder={asAdmin ? 'Reply as Developer…' : 'Write a comment…'} aria-label="Write a comment" onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event) }} />
    <button type="submit" className="fb-send" disabled={sending || !body.trim()} aria-label="Send comment"><Send size={16} /></button>
  </form>
}
