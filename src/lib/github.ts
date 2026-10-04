import { useEffect, useState } from 'react'

const CACHE_KEY = 'github-file-updated'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

type CacheEntry = { date: string; fetchedAt: number }
export type LastUpdated = { status: 'loading' } | { status: 'ready'; date: Date } | { status: 'error' }

function readCache(): Record<string, CacheEntry> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}

function writeCache(url: string, date: string) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [url]: { date, fetchedAt: Date.now() } })) } catch { /* storage full or disabled */ }
}

async function fetchLastCommitDate(blobUrl: string) {
  const match = blobUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
  if (!match) throw new Error('Not a GitHub file URL.')
  const [, owner, repo, branch, path] = match
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${branch}&per_page=1`, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub responded with ${response.status}.`)
  const [commit] = await response.json() as { commit: { committer: { date: string } } }[]
  if (!commit) throw new Error('No commits found for this file.')
  return commit.commit.committer.date
}

const inFlight = new Map<string, Promise<string>>()

export function useFileLastUpdated(blobUrl: string): LastUpdated {
  const [state, setState] = useState<LastUpdated>(() => {
    const cached = readCache()[blobUrl]
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? { status: 'ready', date: new Date(cached.date) } : { status: 'loading' }
  })

  useEffect(() => {
    if (state.status !== 'loading') return
    let active = true
    if (!inFlight.has(blobUrl)) inFlight.set(blobUrl, fetchLastCommitDate(blobUrl).finally(() => inFlight.delete(blobUrl)))
    inFlight.get(blobUrl)!
      .then((date) => { writeCache(blobUrl, date); if (active) setState({ status: 'ready', date: new Date(date) }) })
      .catch(() => {
        const stale = readCache()[blobUrl]
        if (active) setState(stale ? { status: 'ready', date: new Date(stale.date) } : { status: 'error' })
      })
    return () => { active = false }
  }, [blobUrl, state.status])

  return state
}
