import { useSyncExternalStore } from 'react'

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
const STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark'

// Browser UI color for mobile address bars; mirrors --color-bg in theme.css.
const browserBarColors: Record<Theme, string> = { light: '#e8e8e5', dark: '#0f1317' }

const listeners = new Set<() => void>()
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
let theme: Theme = readStoredTheme() ?? systemTheme()
applyTheme()

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch { return null }
}

function systemTheme(): Theme { return systemDark.matches ? 'dark' : 'light' }

function applyTheme() {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', browserBarColors[theme])
}

function setTheme(next: Theme) {
  theme = next
  applyTheme()
  listeners.forEach(listener => listener())
}

systemDark.addEventListener('change', () => { if (!readStoredTheme()) setTheme(systemTheme()) })

export function toggleTheme() {
  const next = theme === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem(STORAGE_KEY, next) } catch { /* storage disabled */ }
  setTheme(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => theme)
}
