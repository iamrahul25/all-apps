import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'admin-session'

export type AdminSession = { token: string; expiresAt: number }

const listeners = new Set<() => void>()
let session = readSession()

function readSession(): AdminSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as AdminSession | null
    return stored && stored.expiresAt > Date.now() ? stored : null
  } catch { return null }
}

function emit() { listeners.forEach(listener => listener()) }

export function getAdminToken() {
  if (session && session.expiresAt <= Date.now()) clearAdminSession()
  return session?.token ?? null
}

export function setAdminSession(next: AdminSession) {
  session = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage disabled */ }
  emit()
}

export function clearAdminSession() {
  session = null
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage disabled */ }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useAdminSession() {
  return useSyncExternalStore(subscribe, () => session)
}
