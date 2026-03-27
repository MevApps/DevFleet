import { describe, it, expect } from 'vitest'
import { formatTokens, formatCurrency, formatPercent, formatTimeAgo } from '../format'

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
