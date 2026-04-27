import { Command } from 'commander'
import ora from 'ora'
import { readFile } from 'fs/promises'
import { createInterface } from 'readline'
import { checkPackages } from './checker.js'
import { formatReport } from './reporter.js'
import { loadConfig, mergeConfig } from './config.js'
import type { CheckOptions, CheckSummary } from './types.js'

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function readStdin(): Promise<string[]> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  const lines: string[] = []
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) lines.push(trimmed)
  }
  return lines
}

async function readFromFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf8')

  if (filePath.endsWith('.json')) {
    const data = JSON.parse(content) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    const names = [
      ...Object.keys(data.dependencies ?? {}),
      ...Object.keys(data.devDependencies ?? {}),
      ...Object.keys(data.peerDependencies ?? {}),
    ]
    return [...new Set(names)]
  }

  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

function getExitCode(summary: CheckSummary, failOnSuspicious: boolean): number {
  if (summary.notFound > 0 || summary.typosquats > 0) return 1
  if (failOnSuspicious && summary.suspicious > 0) return 1
  return 0
}

const program = new Command()

program
  .name('phantom-pkg')
  .description('Validate LLM-recommended npm packages before you install them')
  .version('0.1.0')

program
  .command('check [packages...]')
  .description('Check one or more package names')
  .option('-f, --format <format>', 'Output format: table, json, minimal', 'table')
  .option('-t, --timeout <ms>', 'Registry request timeout in ms', '5000')
  .option('--fail-on-suspicious', 'Exit code 1 if any suspicious packages found')
  .option('-v, --verbose', 'Show all packages in minimal mode')
  .option('--stdin', 'Read package names from stdin')
  .option('--file <path>', 'Read package names from a file or package.json')
  .option('--ignore <pattern>', 'Skip packages matching pattern, e.g. "@myco/*" (repeatable)', collect, [])
  .action(
    async (
      packages: string[],
      cmdOptions: {
        format: string
        timeout: string
        failOnSuspicious?: boolean
        verbose?: boolean
        stdin?: boolean
        file?: string
        ignore: string[]
      },
      cmd: Command,
    ) => {
      try {
        let packageNames: string[] = packages

        if (cmdOptions.stdin) {
          packageNames = await readStdin()
        } else if (cmdOptions.file) {
          packageNames = await readFromFile(cmdOptions.file)
        }

        if (packageNames.length === 0) {
          process.stderr.write('Error: No package names provided.\n')
          process.stderr.write(
            'Usage: phantom-pkg check <packages...>\n' +
            '       phantom-pkg check --stdin\n' +
            '       phantom-pkg check --file package.json\n',
          )
          process.exit(2)
        }

        const cwd = process.cwd()
        const fileConfig = await loadConfig(cwd)

        // Track which options the user explicitly passed on the CLI
        const explicitCliKeys = new Set(
          ['timeout', 'format'].filter(
            k => cmd.getOptionValueSource(k) === 'cli',
          ),
        )

        const cliOptions: CheckOptions = {
          timeout: parseInt(cmdOptions.timeout, 10),
          format: cmdOptions.format as 'table' | 'json' | 'minimal',
          failOnSuspicious: cmdOptions.failOnSuspicious ?? false,
          verbose: cmdOptions.verbose ?? false,
          ignore: cmdOptions.ignore ?? [],
          cwd,
        }

        const options = mergeConfig(fileConfig, cliOptions, explicitCliKeys)
        const format = options.format ?? 'table'

        const useSpinner = !process.env['CI'] && format !== 'json' && process.stderr.isTTY
        const spinner = useSpinner
          ? ora({
              text: `Checking ${packageNames.length} package${packageNames.length === 1 ? '' : 's'}…`,
              stream: process.stderr,
            }).start()
          : null

        let summary: CheckSummary
        try {
          summary = await checkPackages(packageNames, options)
        } finally {
          spinner?.stop()
        }

        const output = formatReport(summary, options)
        process.stdout.write(output)
        if (!output.endsWith('\n')) process.stdout.write('\n')

        process.exit(getExitCode(summary, options.failOnSuspicious ?? false))
      } catch (err) {
        process.stderr.write(
          `Error: ${err instanceof Error ? err.message : 'Unknown error'}\n`,
        )
        process.exit(2)
      }
    },
  )

program.parse()
