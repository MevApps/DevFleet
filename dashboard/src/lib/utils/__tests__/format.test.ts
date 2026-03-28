import { describe, it, expect } from 'vitest'
import { formatTokens, formatCurrency, formatPercent, formatTimeAgo, formatElapsed } from '../format'

describe('formatTokens', () => {
  it('formats millions', () => { expect(formatTokens(1_500_000)).toBe('1.5M') })
  it('formats thousands', () => { expect(formatTokens(42_000)).toBe('42K') })
  it('formats small numbers', () => { expect(formatTokens(500)).toBe('500') })
})
describe('formatCurrency', () => {
  it('formats USD', () => { expect(formatCurrency(4.5)).toBe('$4.50') })
  it('formats zero', () => { expect(formatCurrency(0)).toBe('$0.00') })
})
describe('formatPercent', () => {
  it('formats ratio to percent', () => { expect(formatPercent(0.75)).toBe('75%') })
  it('rounds', () => { expect(formatPercent(0.333)).toBe('33%') })
})
describe('formatTimeAgo', () => {
  it('returns just now for recent timestamps', () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe('just now')
  })
})
describe('formatElapsed', () => {
  it('formats seconds', () => {
    const start = new Date(Date.now() - 30_000).toISOString()
    expect(formatElapsed(start)).toBe('30s')
  })
  it('formats minutes', () => {
    const start = new Date(Date.now() - 840_000).toISOString()
    expect(formatElapsed(start)).toBe('14m')
  })
  it('formats hours and minutes', () => {
    const start = new Date(Date.now() - 3_900_000).toISOString()
    expect(formatElapsed(start)).toBe('1h 5m')
  })
  it('formats zero as 0s', () => {
    const start = new Date().toISOString()
    expect(formatElapsed(start)).toBe('0s')
  })
})
