export type PublicRequest = {
  id: string
  kind: 'problem' | 'demand'
  name?: string
  description?: string
  requirements?: string
  productType?: string
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
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
