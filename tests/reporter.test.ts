import { describe, it, expect } from 'vitest'
import { formatReport } from '../src/reporter.js'
import type { CheckSummary } from '../src/types.js'

const mockSummary: CheckSummary = {
  total: 4,
  safe: 1,
  suspicious: 1,
  notFound: 1,
  typosquats: 1,
  errors: 0,
  ignored: 0,
  results: [
    {
      name: 'lodash',
      status: 'exists',
      signals: {
        weeklyDownloads: 50_000_000,
        publishedDaysAgo: 4000,
        hasReadme: true,
        hasRepository: true,
        maintainerCount: 1,
        versionCount: 50,
        isDeprecated: false,
      },
      typosquatOf: null,
      message: 'Package "lodash" exists and appears legitimate',
      registryUrl: 'https://www.npmjs.com/package/lodash',
    },
    {
      name: 'weird-pkg',
      status: 'suspicious',
      signals: {
        weeklyDownloads: 45,
        publishedDaysAgo: 2,
        hasReadme: false,
        hasRepository: false,
        maintainerCount: 1,
        versionCount: 1,
        isDeprecated: false,
      },
      typosquatOf: null,
      message: 'Package has suspicious signals: low downloads for new package',
      registryUrl: 'https://www.npmjs.com/package/weird-pkg',
    },
    {
      name: 'reactt',
      status: 'not-found',
      signals: null,
      typosquatOf: null,
      message: 'Package "reactt" does not exist on the npm registry',
      registryUrl: 'https://www.npmjs.com/package/reactt',
    },
    {
      name: 'lo-dash',
      status: 'typosquat',
      signals: {
        weeklyDownloads: 1234,
        publishedDaysAgo: 30,
        hasReadme: false,
        hasRepository: false,
        maintainerCount: 1,
        versionCount: 1,
        isDeprecated: false,
      },
      typosquatOf: 'lodash',
      message: 'Possible typosquat of "lodash"',
      registryUrl: 'https://www.npmjs.com/package/lo-dash',
    },
  ],
}

describe('formatReport – table', () => {
  it('contains status symbols for each status type', () => {
    const output = formatReport(mockSummary, { format: 'table' })
    expect(output).toContain('✓')
    expect(output).toContain('⚠')
    expect(output).toContain('✗')
    expect(output).toContain('NOT FOUND')
    expect(output).toContain('TYPOSQUAT')
  })

  it('includes all package names', () => {
    const output = formatReport(mockSummary, { format: 'table' })
    expect(output).toContain('lodash')
    expect(output).toContain('weird-pkg')
    expect(output).toContain('reactt')
    expect(output).toContain('lo-dash')
  })

  it('shows correct summary line counts', () => {
    const output = formatReport(mockSummary, { format: 'table' })
    expect(output).toContain('Checked 4 packages')
    expect(output).toContain('1 safe')
    expect(output).toContain('1 suspicious')
    expect(output).toContain('1 not found')
    expect(output).toContain('1 typosquat')
  })

  it('shows download count and age columns', () => {
    const output = formatReport(mockSummary, { format: 'table' })
    expect(output).toContain('50.0M')
    expect(output).toContain('Downloads/wk')
  })
})

describe('formatReport – json', () => {
  it('produces valid parseable JSON', () => {
    const output = formatReport(mockSummary, { format: 'json' })
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('contains all summary fields', () => {
    const output = formatReport(mockSummary, { format: 'json' })
    const parsed = JSON.parse(output) as CheckSummary
    expect(parsed.total).toBe(4)
    expect(parsed.safe).toBe(1)
    expect(parsed.notFound).toBe(1)
    expect(parsed.typosquats).toBe(1)
    expect(parsed.results).toHaveLength(4)
  })
})

describe('formatReport – minimal', () => {
  it('does not show safe packages by default', () => {
    const output = formatReport(mockSummary, { format: 'minimal' })
    const lines = output.split('\n').filter(l => l.trim())
    // 'lodash' is safe — its own line should not appear
    expect(lines.some(l => /^exists\s+lodash/.test(l))).toBe(false)
  })

  it('shows non-safe packages', () => {
    const output = formatReport(mockSummary, { format: 'minimal' })
    expect(output).toContain('reactt')
    expect(output).toContain('lo-dash')
    expect(output).toContain('weird-pkg')
  })

  it('shows all packages with verbose flag', () => {
    const output = formatReport(mockSummary, { format: 'minimal', verbose: true })
    const lines = output.split('\n').filter(l => l.trim())
    expect(lines.length).toBe(4)
    expect(lines.some(l => l.includes('lodash'))).toBe(true)
  })

  it('uses status as the line prefix', () => {
    const output = formatReport(mockSummary, { format: 'minimal' })
    expect(output).toMatch(/not-found\s+reactt/)
    expect(output).toMatch(/typosquat\s+lo-dash/)
    expect(output).toMatch(/suspicious\s+weird-pkg/)
  })
})
