import { describe, it, expect } from 'vitest'
import { getEntityConfig } from '../entities'

describe('getEntityConfig', () => {
  it('returns config for known entities', () => {
    const agent = getEntityConfig('agent')
    expect(agent.hue).toBe(210)
    expect(agent.icon).toBe('Bot')
    expect(agent.label).toBe('Agent')
  })
  it('returns fallback for unknown entities', () => {
    const unknown = getEntityConfig('deployment')
    expect(unknown.hue).toBe(0)
    expect(unknown.icon).toBe('Circle')
    expect(unknown.label).toBe('deployment')
  })
})
