import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (media: string) => {
    const listeners = new Set<(event: Event) => void>()
    return {
      matches: false,
      media,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: (event: Event) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: Event) => void) =>
        listeners.delete(listener),
      dispatchEvent: (event: Event) => {
        listeners.forEach((listener) => listener(event))
        return true
      },
    } as MediaQueryList
  },
})

afterEach(() => {
  cleanup()
})
