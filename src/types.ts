export type PackageStatus =
  | 'exists'
  | 'not-found'
  | 'suspicious'
  | 'typosquat'
  | 'error'

export interface PackageSignals {
  weeklyDownloads: number | null
  publishedDaysAgo: number | null
  hasReadme: boolean
  hasRepository: boolean
  maintainerCount: number | null
  versionCount: number | null
  isDeprecated: boolean
  unpackedSize: number | null
  license: string | null
  hasInstallScripts: boolean
  lastPublishedDaysAgo: number | null
}

export interface CheckResult {
  name: string
  status: PackageStatus
  signals: PackageSignals | null
  typosquatOf: string | null
  message: string
  registryUrl: string
}

export interface CheckOptions {
  timeout?: number
  format?: 'table' | 'json' | 'minimal'
  failOnSuspicious?: boolean
  verbose?: boolean
  ignore?: string[]
  cwd?: string
}

export interface CheckSummary {
  total: number
  safe: number
  suspicious: number
  notFound: number
  typosquats: number
  errors: number
  ignored: number
  results: CheckResult[]
}
