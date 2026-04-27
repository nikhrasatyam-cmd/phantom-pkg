import { fetchPackageMetadata, fetchDownloadCount } from './registry.js'
import { detectTyposquat } from './typosquat.js'
import {
  loadNpmrc,
  getRegistryForPackage,
  isPublicRegistry,
  isIgnored,
} from './npmrc.js'
import type {
  CheckResult,
  CheckOptions,
  CheckSummary,
  PackageSignals,
} from './types.js'

function isValidPackageName(name: string): boolean {
  if (!name || name.length > 214) return false
  if (name !== name.toLowerCase()) return false
  if (name.startsWith('.') || name.startsWith('_')) return false
  if (name.trim() !== name) return false

  if (name.startsWith('@')) {
    const rest = name.slice(1)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) return false
    const scope = rest.slice(0, slashIdx)
    const pkg = rest.slice(slashIdx + 1)
    return scope.length > 0 && pkg.length > 0 &&
      /^[a-z0-9._-]+$/.test(scope) && /^[a-z0-9._-]+$/.test(pkg)
  }

  return /^[a-z0-9][a-z0-9._-]*$/.test(name)
}

function evaluateSuspicious(signals: PackageSignals, isPrivate = false): boolean {
  if (!isPrivate && signals.weeklyDownloads === null) return true
  if (!isPrivate && signals.weeklyDownloads !== null && signals.weeklyDownloads < 100 &&
      signals.publishedDaysAgo !== null &&
      signals.publishedDaysAgo < 30) return true
  if (signals.maintainerCount === 0 || signals.maintainerCount === null) return true
  if (!signals.hasReadme && !signals.hasRepository) return true
  if (signals.isDeprecated) return true
  if (signals.hasInstallScripts &&
      signals.weeklyDownloads !== null &&
      signals.weeklyDownloads < 1_000) return true
  return false
}

function buildSuspiciousReasons(signals: PackageSignals, isPrivate = false): string[] {
  const reasons: string[] = []
  if (!isPrivate && signals.weeklyDownloads === null) {
    reasons.push('download count unavailable')
  } else if (!isPrivate && signals.weeklyDownloads !== null && signals.weeklyDownloads < 100 &&
             signals.publishedDaysAgo !== null &&
             signals.publishedDaysAgo < 30) {
    reasons.push(`low downloads (${signals.weeklyDownloads}) for a new package`)
  }
  if (signals.maintainerCount === 0 || signals.maintainerCount === null) {
    reasons.push('no maintainers listed')
  }
  if (!signals.hasReadme && !signals.hasRepository) {
    reasons.push('no README or repository')
  }
  if (signals.isDeprecated) {
    reasons.push('package is deprecated')
  }
  if (signals.hasInstallScripts) {
    reasons.push('has install scripts (preinstall/install/postinstall)')
  }
  return reasons
}

export async function checkPackage(
  name: string,
  options: CheckOptions,
  registryOverride?: string,
): Promise<CheckResult> {
  const timeout = options.timeout ?? 5000
  const registryUrl = `https://www.npmjs.com/package/${name}`

  if (!isValidPackageName(name)) {
    return {
      name,
      status: 'error',
      signals: null,
      typosquatOf: null,
      message: `Invalid package name: "${name}"`,
      registryUrl,
    }
  }

  const privateRegistry = registryOverride && !isPublicRegistry(registryOverride)
    ? registryOverride
    : undefined

  let metadata
  try {
    metadata = await fetchPackageMetadata(name, timeout, registryOverride)
  } catch (err) {
    return {
      name,
      status: 'error',
      signals: null,
      typosquatOf: null,
      message: err instanceof Error ? err.message : 'Registry lookup failed',
      registryUrl,
    }
  }

  if (!metadata) {
    return {
      name,
      status: 'not-found',
      signals: null,
      typosquatOf: null,
      message: `Package "${name}" does not exist on${privateRegistry ? ` ${privateRegistry}` : ' the npm registry'}`,
      registryUrl,
    }
  }

  // Skip public download counts and typosquat checks for private registry packages
  const [weeklyDownloads, typosquatOf] = await Promise.all([
    privateRegistry ? Promise.resolve(null) : fetchDownloadCount(name, timeout),
    Promise.resolve(detectTyposquat(name)),
  ])

  const latestVersion = metadata['dist-tags']?.['latest'] ?? ''
  const latestVersionData = latestVersion ? metadata.versions[latestVersion] : undefined

  const createdIso = metadata.time['created']
  const publishedDaysAgo = createdIso
    ? Math.floor((Date.now() - new Date(createdIso).getTime()) / 86_400_000)
    : null

  const lastModifiedIso = latestVersion
    ? (metadata.time[latestVersion] ?? metadata.time['modified'])
    : metadata.time['modified']
  const lastPublishedDaysAgo = lastModifiedIso
    ? Math.floor((Date.now() - new Date(lastModifiedIso).getTime()) / 86_400_000)
    : null

  const installScriptKeys = ['preinstall', 'install', 'postinstall']
  const hasInstallScripts = installScriptKeys.some(
    k => !!latestVersionData?.scripts?.[k],
  )

  const signals: PackageSignals = {
    weeklyDownloads,
    publishedDaysAgo,
    lastPublishedDaysAgo,
    hasReadme: !!metadata.readme,
    hasRepository: !!metadata.repository,
    maintainerCount: metadata.maintainers?.length ?? null,
    versionCount: metadata.versions ? Object.keys(metadata.versions).length : 0,
    isDeprecated: !!latestVersionData?.deprecated,
    unpackedSize: latestVersionData?.dist?.unpackedSize ?? null,
    license: latestVersionData?.license ?? null,
    hasInstallScripts,
  }

  if (typosquatOf) {
    return {
      name,
      status: 'typosquat',
      signals,
      typosquatOf,
      message: `Possible typosquat of "${typosquatOf}". Verify this is the package you intended.`,
      registryUrl,
    }
  }

  if (evaluateSuspicious(signals, !!privateRegistry)) {
    const reasons = buildSuspiciousReasons(signals, !!privateRegistry)
    return {
      name,
      status: 'suspicious',
      signals,
      typosquatOf: null,
      message: `Package has suspicious signals: ${reasons.join(', ')}`,
      registryUrl,
    }
  }

  return {
    name,
    status: 'exists',
    signals,
    typosquatOf: null,
    message: `Package "${name}" exists and appears legitimate`,
    registryUrl,
  }
}

export async function checkPackages(
  names: string[],
  options: CheckOptions,
): Promise<CheckSummary> {
  const ignorePatterns = options.ignore ?? []
  const npmrc = await loadNpmrc(options.cwd)

  const toCheck = names.filter(n => !isIgnored(n, ignorePatterns))
  const ignoredCount = names.length - toCheck.length

  const results = await Promise.all(
    toCheck.map(name => {
      const registry = getRegistryForPackage(name, npmrc)
      return checkPackage(name, options, registry).catch(
        (err): CheckResult => ({
          name,
          status: 'error',
          signals: null,
          typosquatOf: null,
          message: err instanceof Error ? err.message : 'Unknown error',
          registryUrl: `https://www.npmjs.com/package/${name}`,
        }),
      )
    }),
  )

  return {
    total: results.length,
    safe: results.filter(r => r.status === 'exists').length,
    suspicious: results.filter(r => r.status === 'suspicious').length,
    notFound: results.filter(r => r.status === 'not-found').length,
    typosquats: results.filter(r => r.status === 'typosquat').length,
    errors: results.filter(r => r.status === 'error').length,
    ignored: ignoredCount,
    results,
  }
}
