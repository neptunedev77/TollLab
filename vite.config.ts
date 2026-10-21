/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // A cena 3D (three.js + R3F, ~920 kB minificado) é um chunk carregado em diferido, à parte da
    // interface inicial. O limite sobe só o suficiente para esse chunk; o resto continua abaixo de 500 kB.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
  },
})
