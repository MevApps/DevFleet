import { describe, it, expect } from 'vitest'
import { getStatusColor } from '../statuses'

describe('getStatusColor', () => {
  it('maps known statuses to colors', () => {
    expect(getStatusColor('completed')).toBe('green')
    expect(getStatusColor('busy')).toBe('blue')
    expect(getStatusColor('review')).toBe('purple')
    expect(getStatusColor('blocked')).toBe('yellow')
    expect(getStatusColor('paused')).toBe('orange')
    expect(getStatusColor('failed')).toBe('red')
    expect(getStatusColor('idle')).toBe('zinc')
  })
  it('falls back to zinc for unknown statuses', () => {
    expect(getStatusColor('deploying')).toBe('zinc')
    expect(getStatusColor('')).toBe('zinc')
  })
  it('maps additional statuses to colors', () => {
    expect(getStatusColor('delivered')).toBe('green')
    expect(getStatusColor('active')).toBe('blue')
    expect(getStatusColor('queued')).toBe('orange')
  })
})
