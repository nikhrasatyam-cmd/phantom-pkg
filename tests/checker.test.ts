import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NpmPackageData } from '../src/registry.js'

vi.mock('../src/registry.js')

import { checkPackage, checkPackages } from '../src/checker.js'
import { fetchPackageMetadata, fetchDownloadCount } from '../src/registry.js'

const mockMeta = vi.mocked(fetchPackageMetadata)
const mockDownloads = vi.mocked(fetchDownloadCount)

const lodashMeta: NpmPackageData = {
  name: 'lodash',
  description: 'Lodash modular utilities.',
  'dist-tags': { latest: '4.17.21' },
  time: {
    created: '2012-04-20T00:00:00.000Z',
    modified: '2023-01-01T00:00:00.000Z',
  },
  readme: 'Lodash readme',
  repository: { type: 'git', url: 'https://github.com/lodash/lodash' },
  maintainers: [{ name: 'jdalton' }],
  versions: {
    '4.17.21': {},
    '4.17.20': {},
    '4.17.19': {},
  },
}

describe('checkPackage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDownloads.mockResolvedValue(50_000_000)
  })

  it('returns exists for a known-good package', async () => {
    mockMeta.mockResolvedValue(lodashMeta)
    const result = await checkPackage('lodash', {})
    expect(result.status).toBe('exists')
    expect(result.name).toBe('lodash')
    expect(result.typosquatOf).toBeNull()
  })

  it('returns not-found for a non-existent package', async () => {
    mockMeta.mockResolvedValue(null)
    const result = await checkPackage('totally-fake-package-xyz-12345', {})
    expect(result.status).toBe('not-found')
    expect(result.signals).toBeNull()
  })

  it('returns suspicious for package with low downloads and recent creation', async () => {
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString()
    mockMeta.mockResolvedValue({
      ...lodashMeta,
      name: 'weird-new-pkg',
      readme: undefined,
      repository: undefined,
      time: { created: recentDate, modified: recentDate },
    })
    mockDownloads.mockResolvedValue(50)
    const result = await checkPackage('weird-new-pkg', {})
    expect(result.status).toBe('suspicious')
  })

  it('returns suspicious when download count is null', async () => {
    mockMeta.mockResolvedValue(lodashMeta)
    mockDownloads.mockResolvedValue(null)
    const result = await checkPackage('some-pkg', {})
    expect(result.status).toBe('suspicious')
  })

  it('returns suspicious for deprecated package', async () => {
    mockMeta.mockResolvedValue({
      ...lodashMeta,
      versions: { '4.17.21': { deprecated: 'Use other-pkg instead' } },
    })
    const result = await checkPackage('lodash', {})
    expect(result.status).toBe('suspicious')
    expect(result.signals?.isDeprecated).toBe(true)
  })

  it('returns error for invalid package name', async () => {
    const result = await checkPackage('INVALID PACKAGE NAME', {})
    expect(result.status).toBe('error')
    expect(mockMeta).not.toHaveBeenCalled()
  })

  it('returns error when registry throws', async () => {
    mockMeta.mockRejectedValue(new Error('Network error'))
    const result = await checkPackage('some-pkg', {})
    expect(result.status).toBe('error')
    expect(result.message).toContain('Network error')
  })

  it('handles timed-out registry request', async () => {
    mockMeta.mockRejectedValue(new Error('Registry request timed out after 100ms'))
    const result = await checkPackage('some-pkg', { timeout: 100 })
    expect(result.status).toBe('error')
    expect(result.message).toContain('timed out')
  })

  it('populates registryUrl correctly', async () => {
    mockMeta.mockResolvedValue(null)
    const result = await checkPackage('my-pkg', {})
    expect(result.registryUrl).toBe('https://www.npmjs.com/package/my-pkg')
  })
})

describe('checkPackages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDownloads.mockResolvedValue(50_000_000)
  })

  it('handles mixed results correctly', async () => {
    mockMeta
      .mockResolvedValueOnce(lodashMeta)
      .mockResolvedValueOnce(null)

    const summary = await checkPackages(['lodash', 'fake-package-xyz'], {})
    expect(summary.total).toBe(2)
    expect(summary.safe).toBe(1)
    expect(summary.notFound).toBe(1)
  })

  it('does not fail the entire batch when one package errors', async () => {
    mockMeta
      .mockResolvedValueOnce(lodashMeta)
      .mockRejectedValueOnce(new Error('Registry down'))

    const summary = await checkPackages(['lodash', 'some-pkg'], {})
    expect(summary.total).toBe(2)
    expect(summary.errors).toBe(1)
    expect(summary.safe).toBe(1)
  })

  it('returns correct summary counts', async () => {
    mockMeta
      .mockResolvedValueOnce(lodashMeta)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const summary = await checkPackages(['lodash', 'fake1', 'fake2'], {})
    expect(summary.total).toBe(3)
    expect(summary.safe).toBe(1)
    expect(summary.notFound).toBe(2)
    expect(summary.suspicious).toBe(0)
    expect(summary.typosquats).toBe(0)
  })
})
