import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export const PUBLIC_REGISTRY = 'https://registry.npmjs.org'

export interface NpmrcConfig {
  defaultRegistry: string
  scopeRegistries: Map<string, string>
}

async function parseNpmrcFile(filePath: string): Promise<Map<string, string>> {
  try {
    const content = await readFile(filePath, 'utf8')
    const entries = new Map<string, string>()
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim().replace(/\/$/, '')
      entries.set(key, value)
    }
    return entries
  } catch {
    return new Map()
  }
}

export async function loadNpmrc(cwd: string = process.cwd()): Promise<NpmrcConfig> {
  const [projectEntries, userEntries] = await Promise.all([
    parseNpmrcFile(join(cwd, '.npmrc')),
    parseNpmrcFile(join(homedir(), '.npmrc')),
  ])

  // Project-level takes precedence over user-level
  const merged = new Map([...userEntries, ...projectEntries])

  let defaultRegistry = PUBLIC_REGISTRY
  const scopeRegistries = new Map<string, string>()

  for (const [key, value] of merged) {
    if (key === 'registry') {
      defaultRegistry = value
    } else if (key.endsWith(':registry')) {
      const scope = key.slice(0, -':registry'.length)
      scopeRegistries.set(scope, value)
    }
  }

  return { defaultRegistry, scopeRegistries }
}

export function getRegistryForPackage(name: string, config: NpmrcConfig): string {
  if (name.startsWith('@')) {
    const slashIdx = name.indexOf('/')
    if (slashIdx !== -1) {
      const scope = name.slice(0, slashIdx)
      if (config.scopeRegistries.has(scope)) {
        return config.scopeRegistries.get(scope)!
      }
    }
  }
  return config.defaultRegistry
}

export function isPublicRegistry(registryUrl: string): boolean {
  return registryUrl === PUBLIC_REGISTRY ||
    registryUrl === 'https://registry.npmjs.org/'
}

export function matchesIgnorePattern(name: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
  return new RegExp(`^${regexStr}$`).test(name)
}

export function isIgnored(name: string, patterns: string[]): boolean {
  return patterns.some(p => matchesIgnorePattern(name, p))
}
