import { useSyncExternalStore } from 'react'

// Not yet in TypeScript's DOM lib; only Chromium-based browsers (e.g. Chrome on Android) fire it.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const listeners = new Set<() => void>()
let deferredPrompt: BeforeInstallPromptEvent | null = null

function setPrompt(next: BeforeInstallPromptEvent | null) {
  deferredPrompt = next
  listeners.forEach(listener => listener())
}

// Registered at module load so the event isn't missed if it fires before React mounts.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  setPrompt(event as BeforeInstallPromptEvent)
})
window.addEventListener('appinstalled', () => setPrompt(null))

export async function promptInstall() {
  const prompt = deferredPrompt
  if (!prompt) return
  // A prompt event can only be used once.
  setPrompt(null)
  await prompt.prompt()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferredPrompt !== null)
}
