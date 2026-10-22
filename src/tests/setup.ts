import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sem `globals: true`, a Testing Library não limpa o DOM automaticamente entre testes.
afterEach(() => {
  cleanup()
  // Os cenários são guardados no localStorage do jsdom: cada teste começa sem cenários.
  if (typeof window !== 'undefined') window.localStorage.clear()
})
