/** @vitest-environment node */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function importsOf(file: string): string[] {
  const content = readFileSync(file, 'utf8')
  return [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '')
}

const FORBIDDEN = [/^react/, /^three/, /^@react-three/, /\/components\//, /\/store\//, /^zustand/]

describe('arquitetura', () => {
  it.each(['domain', 'data', 'simulation'])('src/%s não depende de React, renderização nem estado da UI', (folder) => {
    const files = sourceFiles(join(SRC, folder))
    expect(files.length).toBeGreaterThan(0)
    const violations = files.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => FORBIDDEN.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${relative(SRC, file)} → ${specifier}`),
    )
    expect(violations).toEqual([])
  })
})
