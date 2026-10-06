import projects from '../data/projects.json'
import { request } from './api'

export const FEEDBACK_TYPES = ['bug', 'suggestion', 'improvement', 'feedback', 'question'] as const
export const FEEDBACK_STATUSES = ['new', 'todo', 'in_progress', 'done', 'closed'] as const
export const FEEDBACK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export type FeedbackType = typeof FEEDBACK_TYPES[number]
export type FeedbackStatus = typeof FEEDBACK_STATUSES[number]
export type FeedbackPriority = typeof FEEDBACK_PRIORITIES[number]

export const typeLabels: Record<FeedbackType, string> = { bug: 'Bug', suggestion: 'Suggestion', improvement: 'Improvement', feedback: 'Feedback', question: 'Question' }
export const statusLabels: Record<FeedbackStatus, string> = { new: 'New', todo: 'To Do', in_progress: 'In Progress', done: 'Done', closed: 'Closed' }
export const priorityLabels: Record<FeedbackPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

export type FeedbackItem = {
  id: number
  app: string
  type: FeedbackType
  title: string
  description: string
  authorName: string | null
  email?: string | null
  status: FeedbackStatus
  priority: FeedbackPriority | null
  assignee: string | null
  tags: string[]
  upvotes: number
  commentCount: number
  voted: boolean
  createdAt: string
  updatedAt: string
}

export type FeedbackComment = { id: number; role: 'admin' | 'submitter'; authorName: string | null; body: string; createdAt: string }
export type FeedbackActivity = { id: number; actor: 'admin' | 'submitter'; field: string; from: string | null; to: string | null; createdAt: string }
export type FeedbackDetail = { item: FeedbackItem; isOwner: boolean; comments: FeedbackComment[]; activity: FeedbackActivity[] }
export type FeedbackCounts = Partial<Record<FeedbackType | 'all', number>>
export type FeedbackSort = 'newest' | 'oldest' | 'votes' | 'comments' | 'updated'
export type FeedbackUpdate = Partial<Pick<FeedbackItem, 'status' | 'type' | 'priority' | 'assignee' | 'tags'>>

export type FeedbackProject = { slug: string; name: string; kind: 'app' | 'website'; description: string; initials: string; accent: string; iconUrl?: string }

const appIcons = import.meta.glob<string>('../assets/app-icons/*', { eager: true, query: '?url', import: 'default' })
const sitePreviews = import.meta.glob<string>('../assets/site-previews/*', { eager: true, query: '?url', import: 'default' })

export const feedbackProjects: FeedbackProject[] = [
  ...projects.apps.map((app): FeedbackProject => ({ slug: app.slug, name: app.name, kind: 'app', description: app.description, initials: app.initials, accent: app.accent, iconUrl: 'icon' in app && app.icon ? appIcons[`../assets/app-icons/${app.icon}`] : undefined })),
  ...projects.websites.map((site): FeedbackProject => ({ slug: site.slug, name: site.name, kind: 'website', description: site.description, initials: site.name.slice(0, 2).toUpperCase(), accent: '#7b7dcc', iconUrl: site.image ? sitePreviews[`../assets/site-previews/${site.image}`] : undefined })),
]

export const findFeedbackProject = (slug: string | undefined) => feedbackProjects.find(project => project.slug === slug)

export const formatFeedbackId = (id: number) => `#FB-${String(id).padStart(4, '0')}`

// Tracking keys prove who submitted an item; the server only stores their hash.
const KEYS_STORAGE = 'feedback-keys'
const VOTER_STORAGE = 'feedback-voter'

function readKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) || '{}') as Record<string, string> } catch { return {} }
}

export function getFeedbackKey(id: number) { return readKeys()[id] ?? null }

export function saveFeedbackKey(id: number, key: string) {
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify({ ...readKeys(), [id]: key })) } catch { /* storage disabled */ }
}

export function forgetFeedbackKey(id: number) {
  const { [id]: _removed, ...rest } = readKeys()
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify(rest)) } catch { /* storage disabled */ }
}

export function ownedFeedbackIds() { return Object.keys(readKeys()).map(Number) }

let voterId: string | null = null
export function getVoterId() {
  if (voterId) return voterId
  try { voterId = localStorage.getItem(VOTER_STORAGE) } catch { /* storage disabled */ }
  if (!voterId) {
    voterId = crypto.randomUUID()
    try { localStorage.setItem(VOTER_STORAGE, voterId) } catch { /* storage disabled */ }
  }
  return voterId
}

export function trackingLink(slug: string, id: number, key: string) {
  return `${window.location.origin}/suggest/${slug}/${id}?key=${encodeURIComponent(key)}`
}

const keyHeader = (id: number): Record<string, string> => {
  const key = getFeedbackKey(id)
  return key ? { 'X-Feedback-Key': key } : {}
}

export type FeedbackListQuery = { app: string; type?: FeedbackType; status?: FeedbackStatus | 'open'; sort?: FeedbackSort; q?: string; ids?: number[] }

export function listFeedback(query: FeedbackListQuery) {
  const params = new URLSearchParams({ app: query.app, voter: getVoterId() })
  if (query.type) params.set('type', query.type)
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  if (query.q) params.set('q', query.q)
  if (query.ids) params.set('ids', query.ids.join(','))
  return request<{ items: FeedbackItem[]; counts: FeedbackCounts }>(`/feedback?${params}`)
}

export async function getFeedbackSummary() {
  return (await request<{ apps: Record<string, { total: number; open: number }> }>('/feedback/summary')).apps
}

export function getFeedback(id: number) {
  return request<FeedbackDetail>(`/feedback/${id}?voter=${getVoterId()}`, { headers: keyHeader(id) })
}

export type NewFeedback = { app: string; type: FeedbackType; title: string; description: string; name: string; email: string; trap: string }

export async function createFeedback(payload: NewFeedback) {
  const result = await request<FeedbackDetail & { key: string }>('/feedback', { method: 'POST', body: JSON.stringify(payload) })
  saveFeedbackKey(result.item.id, result.key)
  return result
}

export function updateFeedback(id: number, changes: FeedbackUpdate) {
  return request<FeedbackDetail>(`/feedback/${id}?voter=${getVoterId()}`, { method: 'PATCH', headers: keyHeader(id), body: JSON.stringify(changes) })
}

export async function deleteFeedback(id: number) {
  await request(`/feedback/${id}`, { method: 'DELETE' })
  forgetFeedbackKey(id)
}

export async function addFeedbackComment(id: number, body: string) {
  return (await request<{ comment: FeedbackComment }>(`/feedback/${id}/comments`, { method: 'POST', headers: keyHeader(id), body: JSON.stringify({ body }) })).comment
}

export async function deleteFeedbackComment(id: number, commentId: number) {
  await request(`/feedback/${id}/comments/${commentId}`, { method: 'DELETE' })
}

export function voteFeedback(id: number, voted: boolean) {
  return request<{ upvotes: number; voted: boolean }>(`/feedback/${id}/vote`, { method: voted ? 'POST' : 'DELETE', body: JSON.stringify({ voterId: getVoterId() }) })
}
