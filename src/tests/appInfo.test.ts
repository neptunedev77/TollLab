import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../appInfo.ts'

describe('appInfo', () => {
  it('expõe o nome da aplicação', () => {
    expect(APP_NAME).toBe('TollLab')
  })
})
