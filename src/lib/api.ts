import { clearAdminSession, getAdminToken, setAdminSession, type AdminSession } from './admin'

export type PublicRequest = {
  id: string
  kind: 'problem' | 'demand'
  name?: string
  description?: string
  requirements?: string
  productType?: string
  email?: string
  createdAt: string
}

type RequestPayload = {
  kind: 'problem' | 'demand'
  name?: string
  description?: string
  requirements?: string
  productType?: string
  email?: string
}

const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken()
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (response.status === 401 && token) clearAdminSession()
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
  return body as T
}

export async function listRequests(kind: 'problem' | 'demand') {
  const response = await request<{ items: PublicRequest[] }>(`/${kind}s`)
  return response.items
}

export async function createRequest(payload: RequestPayload) {
  return request<{ item: PublicRequest }>(`/${payload.kind}s`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteRequest(kind: 'problem' | 'demand', id: string) {
  await request(`/${kind}s/${id}`, { method: 'DELETE' })
}

export async function adminLogin(password: string) {
  setAdminSession(await request<AdminSession>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }))
}
