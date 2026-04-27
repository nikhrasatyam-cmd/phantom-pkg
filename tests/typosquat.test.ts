import { describe, it, expect } from 'vitest'
import { detectTyposquat, levenshtein } from '../src/typosquat.js'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('lodash', 'lodash')).toBe(0)
  })

  it('returns string length when comparing against empty string', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('returns 1 for a single insertion', () => {
    expect(levenshtein('lodas', 'lodash')).toBe(1)
  })

  it('returns 1 for a single deletion', () => {
    expect(levenshtein('lodash', 'lodas')).toBe(1)
  })

  it('returns 1 for a single substitution', () => {
    expect(levenshtein('lodash', 'lodash'.replace('l', 'x'))).toBe(1)
  })

  it('returns 2 for a transposition (swap of adjacent chars)', () => {
    // 'sh' → 'hs' requires 2 substitutions in standard Levenshtein
    expect(levenshtein('lodash', 'lodahs')).toBe(2)
  })
})

describe('detectTyposquat', () => {
  it('detects "lodahs" as a typosquat of "lodash"', () => {
    expect(detectTyposquat('lodahs')).toBe('lodash')
  })

  it('detects "lo-dash" as a typosquat of "lodash" via hyphen removal', () => {
    expect(detectTyposquat('lo-dash')).toBe('lodash')
  })

  it('detects "reactdom" as a typosquat of "react-dom" via hyphen removal', () => {
    expect(detectTyposquat('reactdom')).toBe('react-dom')
  })

  it('does NOT flag "lodash" itself as a typosquat', () => {
    expect(detectTyposquat('lodash')).toBeNull()
  })

  it('does NOT flag "react" itself as a typosquat', () => {
    expect(detectTyposquat('react')).toBeNull()
  })

  it('does NOT flag "react-dom" itself as a typosquat', () => {
    expect(detectTyposquat('react-dom')).toBeNull()
  })

  it('returns null for a clearly unique package name', () => {
    expect(detectTyposquat('some-totally-unique-name-xyz-123')).toBeNull()
  })

  it('returns null for an empty-ish unique name', () => {
    expect(detectTyposquat('my-very-own-unique-pkg-2024')).toBeNull()
  })

  it('detects "momentjs" as a typosquat of "moment" via suffix confusion', () => {
    expect(detectTyposquat('momentjs')).toBe('moment')
  })

  it('is case-insensitive (treats uppercased names as suspicious)', () => {
    // Uppercase names fail isValidPackageName but detectTyposquat normalises them
    const result = detectTyposquat('Lodash')
    // 'lodash' after toLowerCase is in POPULAR_PACKAGES — exact match returns null
    expect(result).toBeNull()
  })

  it('detects one-character typo of "axios"', () => {
    expect(detectTyposquat('axioss')).toBe('axios')
  })

  it('detects "chalk2" as a typosquat of "chalk" (edit distance 1)', () => {
    expect(detectTyposquat('chalk2')).toBe('chalk')
  })
})
