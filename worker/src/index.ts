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
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405, origin)
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
  ])
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  }
}

function response(body: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...corsHeaders(origin) } })
}

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

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
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please provide a valid email address.'
  if (kind === 'problem' && !clean(payload.description, 4000)) return 'A problem description is required.'
  if (kind === 'demand' && !clean(payload.requirements, 4000)) return 'Requirements are required.'
  return null
}

async function handleItem(kind: RequestKind, id: number, request: Request, env: Env, origin: string) {
  if (request.method !== 'DELETE') return response({ error: 'Method not allowed.' }, 405, origin)
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

  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405, origin)

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await initDb(env.DB)
    const origin = env.FRONTEND_ORIGIN || '*'
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/api\/(problems|demands)(?:\/(\d+))?\/?$/)
    const isLogin = url.pathname.replace(/\/$/, '') === '/api/admin/login'
    if (!match && !isLogin) return response({ error: 'Not found.' }, 404, origin)
    try {
      if (isLogin || !match) return await handleAdminLogin(request, env, origin)
      const kind = match[1] as RequestKind
      if (match[2]) return await handleItem(kind, Number(match[2]), request, env, origin)
      return await handleCollection(kind, request, env, origin)
    } catch (error) {
      console.error(error)
      return response({ error: 'The server could not complete that request.' }, 500, origin)
    }
  },
}
