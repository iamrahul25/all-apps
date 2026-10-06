import projects from '../../src/data/projects.json'

export interface Env {
  DB: D1Database
  FRONTEND_ORIGIN?: string
  ADMIN_PASSWORD?: string
}

const ADMIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000
const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Tokens are signed with ADMIN_PASSWORD, so changing the password logs out every session.
async function createAdminToken(secret: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_MS
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: expiresAt })))
  return { token: `${payload}.${toBase64Url(await hmac(secret, payload))}`, expiresAt }
}

async function isAdmin(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token || !env.ADMIN_PASSWORD) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  try {
    if (!sameBytes(fromBase64Url(signature), await hmac(env.ADMIN_PASSWORD, payload))) return false
    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { exp: number }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

async function handleAdminLogin(request: Request, env: Env, origin: string) {
  if (!env.ADMIN_PASSWORD) return response({ error: 'Admin login is not configured.' }, 503, origin)
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  const password = typeof payload?.password === 'string' ? payload.password : ''
  const [given, expected] = await Promise.all([hmac('admin-login', password), hmac('admin-login', env.ADMIN_PASSWORD)])
  if (!sameBytes(given, expected)) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return response({ error: 'Incorrect password.' }, 401, origin)
  }
  return response(await createAdminToken(env.ADMIN_PASSWORD), 200, origin)
}

async function initDb(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS problems (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT,
      description TEXT NOT NULL,
      email       TEXT,
      created_at  TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS demands (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT,
      requirements TEXT NOT NULL,
      product_type TEXT,
      email        TEXT,
      created_at   TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      app_slug       TEXT NOT NULL,
      type           TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      author_name    TEXT,
      author_email   TEXT,
      owner_key_hash TEXT NOT NULL,
      ip_hash        TEXT,
      status         TEXT NOT NULL DEFAULT 'new',
      priority       TEXT,
      assignee       TEXT,
      tags           TEXT NOT NULL DEFAULT '[]',
      upvotes        INTEGER NOT NULL DEFAULT 0,
      comment_count  INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_feedback_app ON feedback (app_slug, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback_comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL,
      author_role TEXT NOT NULL,
      author_name TEXT,
      body        TEXT NOT NULL,
      ip_hash     TEXT,
      created_at  TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_feedback_comments_item ON feedback_comments (feedback_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback_activity (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL,
      actor       TEXT NOT NULL,
      field       TEXT NOT NULL,
      from_value  TEXT,
      to_value    TEXT,
      created_at  TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_feedback_activity_item ON feedback_activity (feedback_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS feedback_votes (
      feedback_id INTEGER NOT NULL,
      voter_id    TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (feedback_id, voter_id)
    )`),
  ])
}

let dbReady: Promise<void> | null = null

function ensureDb(db: D1Database) {
  dbReady ??= initDb(db).catch(error => { dbReady = null; throw error })
  return dbReady
}

type RequestKind = 'problems' | 'demands'

type PublicItem = {
  id: number
  kind: 'problem' | 'demand'
  name?: string
  description?: string
  requirements?: string
  productType?: string
  email?: string
  createdAt: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Feedback-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  }
}

function response(body: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...corsHeaders(origin) } })
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function rowToItem(kind: 'problem' | 'demand', row: Record<string, unknown>): PublicItem {
  return {
    id: row.id as number,
    kind,
    name: (row.name as string | null) ?? undefined,
    description: (row.description as string | null) ?? undefined,
    requirements: (row.requirements as string | null) ?? undefined,
    productType: (row.product_type as string | null) ?? undefined,
    email: (row.email as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

function validatePayload(kind: 'problem' | 'demand', payload: Record<string, unknown>) {
  const email = clean(payload.email, 160)
  if (email && !emailPattern.test(email)) return 'Please provide a valid email address.'
  if (kind === 'problem' && !clean(payload.description, 4000)) return 'A problem description is required.'
  if (kind === 'demand' && !clean(payload.requirements, 4000)) return 'Requirements are required.'
  return null
}

async function handleItem(kind: RequestKind, id: number, request: Request, env: Env, origin: string) {
  if (!(await isAdmin(request, env))) return response({ error: 'Admin login required.' }, 401, origin)
  const result = await env.DB.prepare(`DELETE FROM ${kind} WHERE id = ?`).bind(id).run()
  if (!result.meta.changes) return response({ error: 'Not found.' }, 404, origin)
  return response({ deleted: id }, 200, origin)
}

async function handleCollection(kind: RequestKind, request: Request, env: Env, origin: string) {
  const documentKind = kind === 'problems' ? 'problem' : 'demand'

  if (request.method === 'GET') {
    const email = (await isAdmin(request, env)) ? ', email' : ''
    const sql = kind === 'problems'
      ? `SELECT id, name, description${email}, created_at FROM problems ORDER BY created_at DESC LIMIT 50`
      : `SELECT id, name, requirements, product_type${email}, created_at FROM demands ORDER BY created_at DESC LIMIT 50`
    const { results } = await env.DB.prepare(sql).all<Record<string, unknown>>()
    return response({ items: results.map(row => rowToItem(documentKind, row)) }, 200, origin)
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!payload) return response({ error: 'Invalid JSON body.' }, 400, origin)

  const error = validatePayload(documentKind, payload)
  if (error) return response({ error }, 400, origin)

  const name        = clean(payload.name, 160) || null
  const description = clean(payload.description, 4000) || null
  const requirements = clean(payload.requirements, 4000) || null
  const productType  = clean(payload.productType, 40) || null
  const email        = clean(payload.email, 160) || null
  const createdAt    = new Date().toISOString()

  let insertedId: number

  if (kind === 'problems') {
    const result = await env.DB.prepare(
      `INSERT INTO problems (name, description, email, created_at) VALUES (?, ?, ?, ?) RETURNING id`
    ).bind(name, description, email, createdAt).first<{ id: number }>()
    insertedId = result!.id
  } else {
    const result = await env.DB.prepare(
      `INSERT INTO demands (name, requirements, product_type, email, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`
    ).bind(name, requirements, productType, email, createdAt).first<{ id: number }>()
    insertedId = result!.id
  }

  const item: PublicItem = {
    id: insertedId,
    kind: documentKind,
    name: name ?? undefined,
    description: description ?? undefined,
    requirements: requirements ?? undefined,
    productType: productType ?? undefined,
    createdAt,
  }

  return response({ item }, 201, origin)
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const FEEDBACK_TYPES = ['bug', 'suggestion', 'improvement', 'feedback', 'question']
const FEEDBACK_STATUSES = ['new', 'todo', 'in_progress', 'done', 'closed']
const FEEDBACK_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const FEEDBACK_SORTS: Record<string, string> = {
  newest: 'f.created_at DESC',
  oldest: 'f.created_at ASC',
  votes: 'f.upvotes DESC, f.created_at DESC',
  comments: 'f.comment_count DESC, f.created_at DESC',
  updated: 'f.updated_at DESC',
}
const RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_FEEDBACK_PER_WINDOW = 5
const MAX_COMMENTS_PER_WINDOW = 15
const MAX_TAGS = 10

const feedbackAppTags = new Map<string, string[]>([
  ...projects.apps.map((app): [string, string[]] => [app.slug, ['Android', `v${app.version}`]]),
  ...projects.websites.map((site): [string, string[]] => [site.slug, ['Web']]),
])

type Row = Record<string, unknown>
type Ctx = { request: Request; env: Env; origin: string; url: URL }

function ipHash(request: Request) {
  return sha256Hex(`feedback-ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`)
}

function cleanVoterId(value: unknown) {
  const voterId = clean(value, 64)
  return /^[A-Za-z0-9-]{8,64}$/.test(voterId) ? voterId : ''
}

function parseTags(value: unknown): string[] {
  try {
    const tags = JSON.parse(typeof value === 'string' ? value : '[]')
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function feedbackColumns(fullDescription: boolean) {
  const description = fullDescription ? 'f.description' : 'substr(f.description, 1, 240) AS description'
  return `f.id, f.app_slug, f.type, f.title, ${description}, f.author_name, f.author_email, f.status, f.priority,
    f.assignee, f.tags, f.upvotes, f.comment_count, f.created_at, f.updated_at,
    EXISTS (SELECT 1 FROM feedback_votes v WHERE v.feedback_id = f.id AND v.voter_id = ?) AS voted`
}

function feedbackFromRow(row: Row, admin: boolean) {
  return {
    id: row.id as number,
    app: row.app_slug as string,
    type: row.type as string,
    title: row.title as string,
    description: row.description as string,
    authorName: (row.author_name as string | null) ?? null,
    ...(admin ? { email: (row.author_email as string | null) ?? null } : {}),
    status: row.status as string,
    priority: (row.priority as string | null) ?? null,
    assignee: (row.assignee as string | null) ?? null,
    tags: parseTags(row.tags),
    upvotes: row.upvotes as number,
    commentCount: row.comment_count as number,
    voted: Boolean(row.voted),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function readJson(request: Request) {
  return await request.json().catch(() => null) as Row | null
}

async function isFeedbackOwner(request: Request, ownerKeyHash: unknown) {
  const key = request.headers.get('X-Feedback-Key')
  return Boolean(key) && (await sha256Hex(key!)) === ownerKeyHash
}

async function countRecent(env: Env, table: 'feedback' | 'feedback_comments', ip: string) {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ip_hash = ? AND created_at > ?`).bind(ip, since).first<{ count: number }>()
  return row?.count ?? 0
}

async function loadFeedbackDetail(ctx: Ctx, id: number, voterId: string) {
  const { env, request } = ctx
  const row = await env.DB.prepare(`SELECT ${feedbackColumns(true)}, f.owner_key_hash FROM feedback f WHERE f.id = ?`).bind(voterId, id).first<Row>()
  if (!row) return null
  const [admin, isOwner, comments, activity] = await Promise.all([
    isAdmin(request, env),
    isFeedbackOwner(request, row.owner_key_hash),
    env.DB.prepare(`SELECT id, author_role, author_name, body, created_at FROM feedback_comments WHERE feedback_id = ? ORDER BY created_at ASC`).bind(id).all<Row>(),
    env.DB.prepare(`SELECT id, actor, field, from_value, to_value, created_at FROM feedback_activity WHERE feedback_id = ? ORDER BY created_at ASC, id ASC`).bind(id).all<Row>(),
  ])
  return {
    item: feedbackFromRow(row, admin),
    isOwner,
    comments: comments.results.map(commentFromRow),
    activity: activity.results.map(entry => ({
      id: entry.id as number,
      actor: entry.actor as string,
      field: entry.field as string,
      from: (entry.from_value as string | null) ?? null,
      to: (entry.to_value as string | null) ?? null,
      createdAt: entry.created_at as string,
    })),
  }
}

function commentFromRow(row: Row) {
  return {
    id: row.id as number,
    role: row.author_role as string,
    authorName: (row.author_name as string | null) ?? null,
    body: row.body as string,
    createdAt: row.created_at as string,
  }
}

async function listFeedback(ctx: Ctx) {
  const { url, env, request, origin } = ctx
  const params = url.searchParams
  const app = params.get('app') || ''
  if (!feedbackAppTags.has(app)) return response({ error: 'Unknown app.' }, 404, origin)

  const where = ['f.app_slug = ?']
  const binds: unknown[] = [app]
  const type = params.get('type') || ''
  if (FEEDBACK_TYPES.includes(type)) { where.push('f.type = ?'); binds.push(type) }
  const status = params.get('status') || ''
  if (status === 'open') where.push(`f.status NOT IN ('done', 'closed')`)
  else if (FEEDBACK_STATUSES.includes(status)) { where.push('f.status = ?'); binds.push(status) }
  const query = clean(params.get('q'), 100)
  if (query) {
    const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`
    const idMatch = query.match(/^#?(?:fb-?)?0*(\d+)$/i)
    where.push(`(f.title LIKE ? ESCAPE '\\' OR f.description LIKE ? ESCAPE '\\' OR f.author_name LIKE ? ESCAPE '\\'${idMatch ? ' OR f.id = ?' : ''})`)
    binds.push(like, like, like, ...(idMatch ? [Number(idMatch[1])] : []))
  }
  if (params.has('ids')) {
    const ids = (params.get('ids') || '').split(',').map(Number).filter(id => Number.isInteger(id) && id > 0).slice(0, 100)
    if (ids.length === 0) where.push('0')
    else { where.push(`f.id IN (${ids.map(() => '?').join(', ')})`); binds.push(...ids) }
  }
  const orderBy = FEEDBACK_SORTS[params.get('sort') || ''] ?? FEEDBACK_SORTS.newest
  const voterId = cleanVoterId(params.get('voter'))

  const [admin, list, counts] = await Promise.all([
    isAdmin(request, env),
    env.DB.prepare(`SELECT ${feedbackColumns(false)} FROM feedback f WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT 200`).bind(voterId, ...binds).all<Row>(),
    env.DB.prepare(`SELECT type, COUNT(*) AS count FROM feedback WHERE app_slug = ? GROUP BY type`).bind(app).all<{ type: string; count: number }>(),
  ])
  const typeCounts: Record<string, number> = { all: 0 }
  for (const { type: rowType, count } of counts.results) { typeCounts[rowType] = count; typeCounts.all += count }
  return response({ items: list.results.map(row => feedbackFromRow(row, admin)), counts: typeCounts }, 200, origin)
}

async function feedbackSummary(ctx: Ctx) {
  const { results } = await ctx.env.DB.prepare(
    `SELECT app_slug, COUNT(*) AS total, SUM(CASE WHEN status IN ('done', 'closed') THEN 0 ELSE 1 END) AS open FROM feedback GROUP BY app_slug`
  ).all<{ app_slug: string; total: number; open: number }>()
  const apps: Record<string, { total: number; open: number }> = {}
  for (const row of results) apps[row.app_slug] = { total: row.total, open: row.open }
  return response({ apps }, 200, ctx.origin)
}

async function getFeedback(ctx: Ctx, id: number) {
  const detail = await loadFeedbackDetail(ctx, id, cleanVoterId(ctx.url.searchParams.get('voter')))
  if (!detail) return response({ error: 'Feedback not found.' }, 404, ctx.origin)
  return response(detail, 200, ctx.origin)
}

async function createFeedback(ctx: Ctx) {
  const { request, env, origin } = ctx
  const payload = await readJson(request)
  if (!payload) return response({ error: 'Invalid JSON body.' }, 400, origin)
  // Honeypot: the field is hidden from people, so only bots fill it in.
  if (clean(payload.trap, 200)) return response({ error: 'Submission rejected.' }, 400, origin)

  const app = clean(payload.app, 80)
  const type = clean(payload.type, 20)
  const title = clean(payload.title, 160)
  const description = clean(payload.description, 4000)
  const name = clean(payload.name, 80) || null
  const email = clean(payload.email, 160) || null
  if (!feedbackAppTags.has(app)) return response({ error: 'Choose a valid app or website.' }, 400, origin)
  if (!FEEDBACK_TYPES.includes(type)) return response({ error: 'Choose a feedback type.' }, 400, origin)
  if (!title) return response({ error: 'A title is required.' }, 400, origin)
  if (!description) return response({ error: 'A description is required.' }, 400, origin)
  if (email && !emailPattern.test(email)) return response({ error: 'Please provide a valid email address.' }, 400, origin)

  const ip = await ipHash(request)
  if ((await countRecent(env, 'feedback', ip)) >= MAX_FEEDBACK_PER_WINDOW) {
    return response({ error: 'Too many submissions. Please try again in a few minutes.' }, 429, origin)
  }

  const key = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const now = new Date().toISOString()
  const inserted = await env.DB.prepare(
    `INSERT INTO feedback (app_slug, type, title, description, author_name, author_email, owner_key_hash, ip_hash, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(app, type, title, description, name, email, await sha256Hex(key), ip, JSON.stringify(feedbackAppTags.get(app)), now, now).first<{ id: number }>()
  const id = inserted!.id
  await env.DB.prepare(`INSERT INTO feedback_activity (feedback_id, actor, field, to_value, created_at) VALUES (?, 'submitter', 'created', ?, ?)`).bind(id, type, now).run()

  const detail = await loadFeedbackDetail(ctx, id, '')
  return response({ ...detail, isOwner: true, key }, 201, origin)
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return null
  const tags = value.map(tag => clean(tag, 30)).filter(Boolean)
  return [...new Set(tags)].slice(0, MAX_TAGS)
}

async function updateFeedback(ctx: Ctx, id: number) {
  const { request, env, origin } = ctx
  if (!(await isAdmin(request, env))) return response({ error: 'Admin login required.' }, 401, origin)
  const payload = await readJson(request)
  if (!payload) return response({ error: 'Invalid JSON body.' }, 400, origin)
  const row = await env.DB.prepare(`SELECT status, type, priority, assignee, tags FROM feedback WHERE id = ?`).bind(id).first<Row>()
  if (!row) return response({ error: 'Feedback not found.' }, 404, origin)

  const changes: { field: string; value: string | null; from: string | null; to: string | null }[] = []
  const setField = (field: string, next: string | null, allowed?: string[]) => {
    if (next !== null && allowed && !allowed.includes(next)) return `Invalid ${field}.`
    const current = (row[field] as string | null) ?? null
    if (next !== current) changes.push({ field, value: next, from: current, to: next })
    return null
  }
  const errors = [
    'status' in payload ? setField('status', clean(payload.status, 20), FEEDBACK_STATUSES) : null,
    'type' in payload ? setField('type', clean(payload.type, 20), FEEDBACK_TYPES) : null,
    'priority' in payload ? setField('priority', clean(payload.priority, 20) || null, FEEDBACK_PRIORITIES) : null,
    'assignee' in payload ? setField('assignee', clean(payload.assignee, 80) || null) : null,
  ].filter(Boolean)
  if (errors.length) return response({ error: errors[0] }, 400, origin)
  if ('tags' in payload) {
    const tags = cleanTags(payload.tags)
    if (!tags) return response({ error: 'Tags must be a list.' }, 400, origin)
    const currentTags = parseTags(row.tags)
    if (JSON.stringify(tags) !== JSON.stringify(currentTags)) {
      changes.push({ field: 'tags', value: JSON.stringify(tags), from: currentTags.join(', ') || null, to: tags.join(', ') || null })
    }
  }

  if (changes.length) {
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare(`UPDATE feedback SET ${changes.map(change => `${change.field} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...changes.map(change => change.value), now, id),
      ...changes.map(change => env.DB.prepare(
        `INSERT INTO feedback_activity (feedback_id, actor, field, from_value, to_value, created_at) VALUES (?, 'admin', ?, ?, ?, ?)`
      ).bind(id, change.field, change.from, change.to, now)),
    ])
  }
  return response(await loadFeedbackDetail(ctx, id, cleanVoterId(ctx.url.searchParams.get('voter'))), 200, origin)
}

async function deleteFeedback(ctx: Ctx, id: number) {
  const { request, env, origin } = ctx
  if (!(await isAdmin(request, env))) return response({ error: 'Admin login required.' }, 401, origin)
  const [deleted] = await env.DB.batch([
    env.DB.prepare(`DELETE FROM feedback WHERE id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM feedback_comments WHERE feedback_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM feedback_activity WHERE feedback_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM feedback_votes WHERE feedback_id = ?`).bind(id),
  ])
  if (!deleted.meta.changes) return response({ error: 'Feedback not found.' }, 404, origin)
  return response({ deleted: id }, 200, origin)
}

async function addComment(ctx: Ctx, id: number) {
  const { request, env, origin } = ctx
  const row = await env.DB.prepare(`SELECT author_name, owner_key_hash FROM feedback WHERE id = ?`).bind(id).first<Row>()
  if (!row) return response({ error: 'Feedback not found.' }, 404, origin)
  const admin = await isAdmin(request, env)
  if (!admin && !(await isFeedbackOwner(request, row.owner_key_hash))) {
    return response({ error: 'Only the person who submitted this feedback can reply.' }, 403, origin)
  }
  const payload = await readJson(request)
  const body = clean(payload?.body, 2000)
  if (!body) return response({ error: 'A comment cannot be empty.' }, 400, origin)

  const ip = await ipHash(request)
  if (!admin && (await countRecent(env, 'feedback_comments', ip)) >= MAX_COMMENTS_PER_WINDOW) {
    return response({ error: 'Too many comments. Please try again in a few minutes.' }, 429, origin)
  }

  const now = new Date().toISOString()
  const [inserted] = await env.DB.batch<Row>([
    env.DB.prepare(
      `INSERT INTO feedback_comments (feedback_id, author_role, author_name, body, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, author_role, author_name, body, created_at`
    ).bind(id, admin ? 'admin' : 'submitter', admin ? 'Developer' : (row.author_name as string | null) ?? null, body, ip, now),
    env.DB.prepare(`UPDATE feedback SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?`).bind(now, id),
  ])
  return response({ comment: commentFromRow(inserted.results[0]) }, 201, origin)
}

async function deleteComment(ctx: Ctx, id: number, commentId: number) {
  const { request, env, origin } = ctx
  if (!(await isAdmin(request, env))) return response({ error: 'Admin login required.' }, 401, origin)
  const result = await env.DB.prepare(`DELETE FROM feedback_comments WHERE id = ? AND feedback_id = ?`).bind(commentId, id).run()
  if (!result.meta.changes) return response({ error: 'Comment not found.' }, 404, origin)
  await env.DB.prepare(`UPDATE feedback SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?`).bind(id).run()
  return response({ deleted: commentId }, 200, origin)
}

async function voteFeedback(ctx: Ctx, id: number) {
  const { request, env, origin } = ctx
  const voterId = cleanVoterId((await readJson(request))?.voterId)
  if (!voterId) return response({ error: 'A voter ID is required.' }, 400, origin)
  const exists = await env.DB.prepare(`SELECT 1 FROM feedback WHERE id = ?`).bind(id).first()
  if (!exists) return response({ error: 'Feedback not found.' }, 404, origin)

  const adding = request.method === 'POST'
  const result = adding
    ? await env.DB.prepare(`INSERT OR IGNORE INTO feedback_votes (feedback_id, voter_id, created_at) VALUES (?, ?, ?)`).bind(id, voterId, new Date().toISOString()).run()
    : await env.DB.prepare(`DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_id = ?`).bind(id, voterId).run()
  if (result.meta.changes) {
    await env.DB.prepare(`UPDATE feedback SET upvotes = MAX(upvotes ${adding ? '+' : '-'} 1, 0) WHERE id = ?`).bind(id).run()
  }
  const row = await env.DB.prepare(`SELECT upvotes FROM feedback WHERE id = ?`).bind(id).first<{ upvotes: number }>()
  return response({ upvotes: row?.upvotes ?? 0, voted: adding }, 200, origin)
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

type Handler = (ctx: Ctx, params: string[]) => Promise<Response>

const routes: [methods: string[], pattern: RegExp, handler: Handler][] = [
  [['POST'], /^\/api\/admin\/login$/, ctx => handleAdminLogin(ctx.request, ctx.env, ctx.origin)],
  [['GET', 'POST'], /^\/api\/(problems|demands)$/, (ctx, [kind]) => handleCollection(kind as RequestKind, ctx.request, ctx.env, ctx.origin)],
  [['DELETE'], /^\/api\/(problems|demands)\/(\d+)$/, (ctx, [kind, id]) => handleItem(kind as RequestKind, Number(id), ctx.request, ctx.env, ctx.origin)],
  [['GET'], /^\/api\/feedback$/, ctx => listFeedback(ctx)],
  [['POST'], /^\/api\/feedback$/, ctx => createFeedback(ctx)],
  [['GET'], /^\/api\/feedback\/summary$/, ctx => feedbackSummary(ctx)],
  [['GET'], /^\/api\/feedback\/(\d+)$/, (ctx, [id]) => getFeedback(ctx, Number(id))],
  [['PATCH'], /^\/api\/feedback\/(\d+)$/, (ctx, [id]) => updateFeedback(ctx, Number(id))],
  [['DELETE'], /^\/api\/feedback\/(\d+)$/, (ctx, [id]) => deleteFeedback(ctx, Number(id))],
  [['POST'], /^\/api\/feedback\/(\d+)\/comments$/, (ctx, [id]) => addComment(ctx, Number(id))],
  [['DELETE'], /^\/api\/feedback\/(\d+)\/comments\/(\d+)$/, (ctx, [id, commentId]) => deleteComment(ctx, Number(id), Number(commentId))],
  [['POST', 'DELETE'], /^\/api\/feedback\/(\d+)\/vote$/, (ctx, [id]) => voteFeedback(ctx, Number(id))],
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.FRONTEND_ORIGIN || '*'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '')
    const matches = routes.map(([methods, pattern, handler]) => ({ methods, handler, match: path.match(pattern) })).filter(route => route.match)
    if (matches.length === 0) return response({ error: 'Not found.' }, 404, origin)
    const route = matches.find(candidate => candidate.methods.includes(request.method))
    if (!route) return response({ error: 'Method not allowed.' }, 405, origin)
    try {
      await ensureDb(env.DB)
      return await route.handler({ request, env, origin, url }, route.match!.slice(1))
    } catch (error) {
      console.error(error)
      return response({ error: 'The server could not complete that request.' }, 500, origin)
    }
  },
}
