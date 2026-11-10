import { describe, expect, it } from 'vitest'
import { calculateJastipFee } from './fees'

describe('calculateJastipFee', () => {
  it('returns zero for no products', () => expect(calculateJastipFee(0)).toBe(0))
  it('charges 15k for one product', () => expect(calculateJastipFee(1)).toBe(15000))
  it('charges 25k for two products', () => expect(calculateJastipFee(2)).toBe(25000))
  it('adds 10k for each product after the second', () => {
    expect(calculateJastipFee(3)).toBe(35000)
    expect(calculateJastipFee(4)).toBe(45000)
    expect(calculateJastipFee(10)).toBe(105000)
  })
  it('normalizes invalid and fractional counts', () => {
    expect(calculateJastipFee(-2)).toBe(0)
    expect(calculateJastipFee(2.9)).toBe(25000)
    expect(calculateJastipFee(Number.NaN)).toBe(0)
  })
})
