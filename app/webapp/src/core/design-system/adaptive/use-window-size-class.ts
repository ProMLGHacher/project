import { useSyncExternalStore } from 'react'
import { createWindowSizeClass } from './window-size'
import type { WindowSizeClass } from './types'

const fallbackWindowSizeClass = createWindowSizeClass(1024, 768)
let cachedWindowSizeClass: WindowSizeClass | undefined

function subscribeToWindowResize(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange)
  window.addEventListener('orientationchange', onStoreChange)

  return () => {
    window.removeEventListener('resize', onStoreChange)
    window.removeEventListener('orientationchange', onStoreChange)
  }
}

function readWindowSizeClass() {
  if (typeof window === 'undefined') return fallbackWindowSizeClass

  const widthPx = window.innerWidth
  const heightPx = window.innerHeight
  if (
    cachedWindowSizeClass &&
    cachedWindowSizeClass.widthPx === widthPx &&
    cachedWindowSizeClass.heightPx === heightPx
  ) {
    return cachedWindowSizeClass
  }

  cachedWindowSizeClass = createWindowSizeClass(widthPx, heightPx)
  return cachedWindowSizeClass
}

export function useWindowSizeClass() {
  return useSyncExternalStore(
    subscribeToWindowResize,
    readWindowSizeClass,
    () => fallbackWindowSizeClass
  )
}
