const POPULAR_PACKAGES: Set<string> = new Set([
  'react',
  'react-dom',
  'lodash',
  'axios',
  'express',
  'typescript',
  'webpack',
  'babel-core',
  'next',
  'vue',
  'angular',
  'svelte',
  'tailwindcss',
  'vite',
  'vitest',
  'jest',
  'mocha',
  'chai',
  'prettier',
  'eslint',
  'zod',
  'prisma',
  'drizzle-orm',
  'trpc',
  'remix',
  'nuxt',
  'astro',
  'solid-js',
  '@tanstack/query',
  '@tanstack/router',
  'zustand',
  'jotai',
  'pinia',
  'date-fns',
  'dayjs',
  'moment',
  'uuid',
  'nanoid',
  'chalk',
  'commander',
  'yargs',
  'dotenv',
  'cors',
  'helmet',
  'morgan',
  'socket.io',
  'mongoose',
  'sequelize',
  'typeorm',
  'knex',
  'pg',
  'mysql2',
  'redis',
])

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length

  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j]!, dp[i][j - 1]!, dp[i - 1][j - 1]!)
      }
    }
  }

  return dp[m][n]!
}

export function detectTyposquat(name: string): string | null {
  const normalized = name.toLowerCase()

  // Exact match — the package IS the popular one
  if (POPULAR_PACKAGES.has(normalized)) return null

  for (const popular of POPULAR_PACKAGES) {
    // Edit distance ≤ 2
    if (levenshtein(normalized, popular) <= 2) return popular

    // Hyphen/underscore swap
    const normDashes = normalized.replace(/[-_]/g, '-')
    const popDashes = popular.replace(/[-_]/g, '-')
    if (normDashes !== normalized && normDashes === popDashes) return popular
    if (normalized.replace(/[-_]/g, '_') === popular.replace(/[-_]/g, '_') &&
        normalized !== popular) return popular

    // Missing/extra hyphen (reactdom ↔ react-dom)
    if (normalized.replace(/-/g, '') === popular.replace(/-/g, '') &&
        normalized !== popular) return popular

    // Common prefix confusion (momentjs ↔ moment)
    if (normalized === popular + 'js' ||
        normalized === popular + '-js' ||
        popular === normalized + 'js' ||
        popular === normalized + '-js') return popular
  }

  return null
}
