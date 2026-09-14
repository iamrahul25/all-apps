export interface Env {
  DB: D1Database
  FRONTEND_ORIGIN?: string
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
  createdAt: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

function response(body: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
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

async function handleCollection(kind: RequestKind, request: Request, env: Env, origin: string) {
  const documentKind = kind === 'problems' ? 'problem' : 'demand'

  if (request.method === 'GET') {
    const sql = kind === 'problems'
      ? `SELECT id, name, description, created_at FROM problems ORDER BY created_at DESC LIMIT 50`
      : `SELECT id, name, requirements, product_type, created_at FROM demands ORDER BY created_at DESC LIMIT 50`
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
    if (request.method === 'OPTIONS') return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
    })
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/api\/(problems|demands)\/?$/)
    if (!match) return response({ error: 'Not found.' }, 404, origin)
    try {
      return await handleCollection(match[1] as RequestKind, request, env, origin)
    } catch (error) {
      console.error(error)
      return response({ error: 'The server could not complete that request.' }, 500, origin)
    }
  },
}
