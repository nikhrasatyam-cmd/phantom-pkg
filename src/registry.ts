export interface NpmPackageData {
  name: string
  description?: string
  'dist-tags': Record<string, string>
  time: Record<string, string>
  readme?: string
  repository?: { type: string; url: string } | string
  maintainers?: Array<{ name: string; email?: string }>
  versions: Record<string, {
    deprecated?: string
    dist?: { unpackedSize?: number; size?: number }
    license?: string
    scripts?: Record<string, string>
  }>
}

export async function fetchPackageMetadata(
  name: string,
  timeout: number,
  registryUrl = 'https://registry.npmjs.org',
): Promise<NpmPackageData | null> {
  try {
    const response = await fetch(`${registryUrl.replace(/\/$/, '')}/${name}`, {
      signal: AbortSignal.timeout(timeout),
      headers: { Accept: 'application/json' },
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Registry returned HTTP ${response.status}`)
    }

    return (await response.json()) as NpmPackageData
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`Registry request timed out after ${timeout}ms`)
    }
    throw err
  }
}

export async function fetchDownloadCount(
  name: string,
  timeout: number,
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${name}`,
      {
        signal: AbortSignal.timeout(timeout),
        headers: { Accept: 'application/json' },
      },
    )

    if (!response.ok) return null

    const data = (await response.json()) as { downloads?: number }
    return data.downloads ?? null
  } catch {
    return null
  }
}
