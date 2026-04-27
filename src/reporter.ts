import chalk from 'chalk'
import type { CheckResult, CheckOptions, CheckSummary, PackageStatus } from './types.js'

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

function padEndVisual(str: string, width: number): string {
  const visual = stripAnsi(str).length
  return str + ' '.repeat(Math.max(0, width - visual))
}

function formatDownloads(downloads: number | null): string {
  if (downloads === null) return '-'
  if (downloads >= 1_000_000) return `${(downloads / 1_000_000).toFixed(1)}M`
  if (downloads >= 1_000) return `${Math.round(downloads / 1_000)}K`
  return downloads.toString()
}

function formatAge(daysAgo: number | null): string {
  if (daysAgo === null) return '-'
  if (daysAgo < 1) return '< 1 day'
  if (daysAgo < 7) return `${daysAgo}d`
  if (daysAgo < 30) return `${Math.floor(daysAgo / 7)}wk`
  if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo`
  return `${Math.floor(daysAgo / 365)}yr`
}

function getStatusRaw(status: PackageStatus): string {
  switch (status) {
    case 'exists': return '✓ exists'
    case 'suspicious': return '⚠ suspicious'
    case 'typosquat': return '✗ TYPOSQUAT'
    case 'not-found': return '✗ NOT FOUND'
    case 'error': return '? error'
  }
}

function getStatusColored(status: PackageStatus): string {
  const raw = getStatusRaw(status)
  switch (status) {
    case 'exists': return chalk.green(raw)
    case 'suspicious': return chalk.yellow(raw)
    case 'typosquat': return chalk.red(raw)
    case 'not-found': return chalk.red(raw)
    case 'error': return chalk.gray(raw)
  }
}

function getRowNote(result: CheckResult): string {
  if (result.typosquatOf) return `Possible typosquat of "${result.typosquatOf}"`
  if (result.status === 'suspicious') {
    return result.message.replace('Package has suspicious signals: ', '')
  }
  if (result.status === 'error') return result.message
  return ''
}

function formatSummaryLine(summary: CheckSummary): string {
  const parts: string[] = [`${summary.safe} safe`]
  if (summary.suspicious > 0) parts.push(`${summary.suspicious} suspicious`)
  if (summary.notFound > 0) parts.push(`${summary.notFound} not found`)
  if (summary.typosquats > 0) parts.push(`${summary.typosquats} typosquat${summary.typosquats === 1 ? '' : 's'}`)
  if (summary.errors > 0) parts.push(`${summary.errors} error${summary.errors === 1 ? '' : 's'}`)
  const ignoredSuffix = summary.ignored > 0 ? ` (${summary.ignored} ignored)` : ''
  return `Checked ${summary.total} package${summary.total === 1 ? '' : 's'}: ${parts.join(', ')}${ignoredSuffix}`
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '-'
  if (bytes < 1_024) return `${bytes}B`
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)}KB`
  return `${(bytes / (1_024 * 1_024)).toFixed(1)}MB`
}

function formatLicense(license: string | null): string {
  if (!license) return '-'
  if (license.length > 14) return license.slice(0, 13) + '…'
  return license
}

function formatInstallScripts(has: boolean): string {
  return has ? '⚠ yes' : '-'
}

function formatMaintainers(count: number | null): string {
  if (count === null) return '-'
  return count.toString()
}

function formatVersions(count: number | null): string {
  if (count === null) return '-'
  return count.toString()
}

function coloredBool(value: boolean | undefined): string {
  if (value === undefined) return '-'
  return value ? chalk.green('✓') : chalk.red('✗')
}

function formatTable(summary: CheckSummary): string {
  const headers = ['Package Name', 'Status', 'Downloads/wk', 'Age', 'Last pub', 'Size', 'License', 'Scripts', 'Maint', 'Vers', 'RM', 'Repo', 'Note']

  const rows = summary.results.map(r => {
    const showSignals = r.status !== 'typosquat' && r.status !== 'not-found' && r.status !== 'error'
    const s = showSignals ? r.signals : null

    return {
    name: r.name,
    statusRaw: getStatusRaw(r.status),
    statusColored: getStatusColored(r.status),
    downloads: s ? formatDownloads(s.weeklyDownloads) : '-',
    age: s ? formatAge(s.publishedDaysAgo) : '-',
    lastPub: s ? formatAge(s.lastPublishedDaysAgo) : '-',
    size: s ? formatSize(s.unpackedSize) : '-',
    license: s ? formatLicense(s.license) : '-',
    licenseColored: s
      ? (!s.license || s.license.toUpperCase() === 'UNLICENSED'
          ? chalk.red(formatLicense(s.license))
          : formatLicense(s.license))
      : '-',
    scripts: s ? formatInstallScripts(s.hasInstallScripts) : '-',
    scriptsColored: s
      ? (s.hasInstallScripts ? chalk.yellow('⚠ yes') : '-')
      : '-',
    maintainers: s ? formatMaintainers(s.maintainerCount) : '-',
    maintainersColored: s
      ? (s.maintainerCount === 0 || s.maintainerCount === null
          ? chalk.red(formatMaintainers(s.maintainerCount))
          : formatMaintainers(s.maintainerCount))
      : '-',
    versions: s ? formatVersions(s.versionCount) : '-',
    versionsColored: s
      ? (s.versionCount !== null && s.versionCount <= 1
          ? chalk.yellow(formatVersions(s.versionCount))
          : formatVersions(s.versionCount))
      : '-',
    readme: s ? (s.hasReadme ? '✓' : '✗') : '-',
    readmeColored: s ? coloredBool(s.hasReadme) : '-',
    repo: s ? (s.hasRepository ? '✓' : '✗') : '-',
    repoColored: s ? coloredBool(s.hasRepository) : '-',
    note: getRowNote(r),
  }
  })

  const colWidths = [
    Math.max(headers[0]!.length, ...rows.map(r => r.name.length)) + 2,
    Math.max(headers[1]!.length, ...rows.map(r => r.statusRaw.length)) + 2,
    Math.max(headers[2]!.length, ...rows.map(r => r.downloads.length)) + 2,
    Math.max(headers[3]!.length, ...rows.map(r => r.age.length)) + 2,
    Math.max(headers[4]!.length, ...rows.map(r => r.lastPub.length)) + 2,
    Math.max(headers[5]!.length, ...rows.map(r => r.size.length)) + 2,
    Math.max(headers[6]!.length, ...rows.map(r => r.license.length)) + 2,
    Math.max(headers[7]!.length, ...rows.map(r => r.scripts.length)) + 2,
    Math.max(headers[8]!.length, ...rows.map(r => r.maintainers.length)) + 2,
    Math.max(headers[9]!.length, ...rows.map(r => r.versions.length)) + 2,
    Math.max(headers[10]!.length, ...rows.map(r => r.readme.length)) + 2,
    Math.max(headers[11]!.length, ...rows.map(r => r.repo.length)) + 2,
    Math.max(headers[12]!.length, ...rows.map(r => r.note.length)),
  ] as [number, number, number, number, number, number, number, number, number, number, number, number, number]

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  const separator = '─'.repeat(totalWidth)

  const lines: string[] = []

  lines.push(headers.map((h, i) => h.padEnd(colWidths[i]!)).join(''))
  lines.push(separator)

  for (const row of rows) {
    lines.push([
      row.name.padEnd(colWidths[0]!),
      padEndVisual(row.statusColored, colWidths[1]!),
      row.downloads.padEnd(colWidths[2]!),
      row.age.padEnd(colWidths[3]!),
      row.lastPub.padEnd(colWidths[4]!),
      row.size.padEnd(colWidths[5]!),
      padEndVisual(row.licenseColored, colWidths[6]!),
      padEndVisual(row.scriptsColored, colWidths[7]!),
      padEndVisual(row.maintainersColored, colWidths[8]!),
      padEndVisual(row.versionsColored, colWidths[9]!),
      padEndVisual(row.readmeColored, colWidths[10]!),
      padEndVisual(row.repoColored, colWidths[11]!),
      row.note,
    ].join(''))
  }

  lines.push(separator)
  lines.push('')
  lines.push(formatSummaryLine(summary))

  return lines.join('\n')
}

function formatJson(summary: CheckSummary): string {
  return JSON.stringify(summary, null, 2)
}

function formatMinimal(summary: CheckSummary, verbose: boolean): string {
  const lines: string[] = []

  for (const result of summary.results) {
    if (!verbose && result.status === 'exists') continue
    lines.push(`${result.status.padEnd(12)} ${result.name}`)
  }

  return lines.join('\n')
}

export function formatReport(summary: CheckSummary, options: CheckOptions): string {
  const format = options.format ?? 'table'
  const verbose = options.verbose ?? false

  switch (format) {
    case 'json': return formatJson(summary)
    case 'minimal': return formatMinimal(summary, verbose)
    default: return formatTable(summary)
  }
}
