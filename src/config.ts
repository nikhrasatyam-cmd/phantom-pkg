import { readFile } from 'fs/promises'
import { join } from 'path'
import type { CheckOptions } from './types.js'

export interface PhantomConfig {
  ignore?: string[]
  failOnSuspicious?: boolean
  timeout?: number
  format?: 'table' | 'json' | 'minimal'
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

function validateConfig(raw: unknown): PhantomConfig {
  if (typeof raw !== 'object' || raw === null) return {}
  const c = raw as Record<string, unknown>
  const result: PhantomConfig = {}

  if (Array.isArray(c['ignore'])) {
    result.ignore = c['ignore'].filter((x): x is string => typeof x === 'string')
  }
  if (typeof c['failOnSuspicious'] === 'boolean') {
    result.failOnSuspicious = c['failOnSuspicious']
  }
  if (typeof c['timeout'] === 'number' && c['timeout'] > 0) {
    result.timeout = c['timeout']
  }
  if (c['format'] === 'table' || c['format'] === 'json' || c['format'] === 'minimal') {
    result.format = c['format']
  }

  return result
}

export async function loadConfig(cwd: string = process.cwd()): Promise<PhantomConfig> {
  // 1. Check package.json for a "phantom-pkg" key
  const pkg = await readJson(join(cwd, 'package.json'))
  if (typeof pkg === 'object' && pkg !== null) {
    const entry = (pkg as Record<string, unknown>)['phantom-pkg']
    if (entry !== undefined) return validateConfig(entry)
  }

  // 2. Fall back to .phantomrc.json
  const rc = await readJson(join(cwd, '.phantomrc.json'))
  if (rc !== null) return validateConfig(rc)

  return {}
}

/**
 * Merges file config with CLI options. CLI always wins for scalar values;
 * ignore lists are merged (file patterns + CLI patterns).
 *
 * Pass the set of option names that were explicitly provided on the CLI
 * (via commander's getOptionValueSource) so we don't let defaults silently
 * override config file values.
 */
export function mergeConfig(
  fileConfig: PhantomConfig,
  cliOptions: CheckOptions,
  explicitCliKeys: Set<string>,
): CheckOptions {
  return {
    timeout: explicitCliKeys.has('timeout')
      ? cliOptions.timeout
      : (fileConfig.timeout ?? cliOptions.timeout),

    format: explicitCliKeys.has('format')
      ? cliOptions.format
      : (fileConfig.format ?? cliOptions.format),

    failOnSuspicious: cliOptions.failOnSuspicious || fileConfig.failOnSuspicious,

    // Merge both ignore lists — config file base + CLI additions
    ignore: [...(fileConfig.ignore ?? []), ...(cliOptions.ignore ?? [])],

    verbose: cliOptions.verbose,
    cwd: cliOptions.cwd,
  }
}
