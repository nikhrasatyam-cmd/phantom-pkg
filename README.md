# phantom-pkg

[![npm version](https://img.shields.io/npm/v/phantom-pkg.svg)](https://www.npmjs.com/package/phantom-pkg)
[![npm downloads](https://img.shields.io/npm/dw/phantom-pkg.svg)](https://www.npmjs.com/package/phantom-pkg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Validate LLM-recommended npm packages before you install them.

## Why This Exists

In October 2025, the **PhantomRaven** campaign planted 126 malicious npm
packages that accumulated 86,000+ installs by exploiting LLM hallucinations —
registering the exact fake package names that AI assistants suggest to
developers. This attack vector is called **slopsquatting**.

Sonatype's 2026 research found that **20%+ of LLM-recommended package names
are hallucinated** — names that don't exist on the registry, or worse, names
that attackers have proactively registered.

`phantom-pkg` validates packages *before* `npm install` runs.

## The Problem

LLMs hallucinate npm package names. Sonatype's 2026 research found that **28% of
LLM-assisted dependency recommendations reference non-existent or incorrect packages.**
Real packages can also be **typosquats** — malicious clones of popular packages
registered under subtly misspelled names.

> When an AI assistant suggests `"unused-imports"` as a simpler alternative to
> `"eslint-plugin-unused-imports"`, and an attacker has already registered that
> name with credential-stealing malware — you've been slopsquatted.

`phantom-pkg` catches both problems *before* `npm install` runs.

## Installation

```bash
npm install -g phantom-pkg
```

## Usage

### Check packages directly

```bash
phantom-pkg check lodash axios reactt
```

### Read from stdin

```bash
echo "lodash\naxios\nlodahs" | phantom-pkg check --stdin

# Or pipe from another command
cat packages.txt | phantom-pkg check --stdin

# From package.json dependencies
cat package.json | jq -r '.dependencies | keys[]' | phantom-pkg check --stdin
```

### Read from a file

```bash
# Automatically parses dependencies, devDependencies, peerDependencies
phantom-pkg check --file package.json

# One package name per line
phantom-pkg check --file packages.txt
```

## CLI Options

| Flag                    | Short | Description                                    | Default  |
|-------------------------|-------|------------------------------------------------|----------|
| `--format <type>`       | `-f`  | Output format: `table`, `json`, `minimal`      | `table`  |
| `--timeout <ms>`        | `-t`  | Registry request timeout in ms                 | `5000`   |
| `--fail-on-suspicious`  |       | Exit code 1 if any suspicious packages found   | off      |
| `--verbose`             | `-v`  | Show all packages in minimal format            | off      |
| `--stdin`               |       | Read package names from stdin                  | off      |
| `--file <path>`         |       | Read from a `.txt` file or `package.json`      | —        |
| `--ignore <pattern>`    |       | Skip packages matching pattern (repeatable)    | —        |

## Output Formats

### Table (default)

```bash
phantom-pkg check lodash reactt lo-dash haski typescriptjs solana-transaction-toolkit
```

```
Package Name                Status          Downloads/wk  Age   Last pub  Size   License  Scripts  Maint  Vers  RM  Repo  Note
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
lodash                      ✓ exists        146.4M        14yr  3wk       1.3MB  MIT      -        1      117   ✓   ✓
reactt                      ✗ NOT FOUND     -             -     -         -      -        -        -      -     -   -
lo-dash                     ✗ TYPOSQUAT     -             -     -         -      -        -        -      -     -   -     Possible typosquat of "lodash"
haski                       ⚠ suspicious    -             1yr   1yr       -      -        -        -      0     ✗   ✗     download count unavailable, no maintainers listed, no README or repository
typescriptjs                ✗ TYPOSQUAT     -             -     -         -      -        -        -      -     -   -     Possible typosquat of "typescript"
solana-transaction-toolkit  ⚠ suspicious    2             1yr   1yr       458B   -        -        0      1     ✗   ✓     no maintainers listed
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Checked 6 packages: 1 safe, 2 suspicious, 1 not found, 2 typosquats
```

Column guide:
- **Age** — days since the package was first published
- **Last pub** — days since the latest version was published
- **Size** — unpacked install size of the latest version
- **License** — SPDX license identifier (red if unlicensed)
- **Scripts** — ⚠ yes if the package has `preinstall`/`install`/`postinstall` scripts that run on `npm install`
- **Maint** — number of maintainers (red if 0)
- **Vers** — number of published versions (yellow if ≤ 1)
- **RM** — has a README (✓ green / ✗ red)
- **Repo** — has a repository link (✓ green / ✗ red)

### JSON

```bash
phantom-pkg check lodash reactt --format json
```

```json
{
  "total": 2,
  "safe": 1,
  "suspicious": 0,
  "notFound": 1,
  "typosquats": 0,
  "errors": 0,
  "ignored": 0,
  "results": [
    {
      "name": "lodash",
      "status": "exists",
      "signals": {
        "weeklyDownloads": 50234567,
        "publishedDaysAgo": 4015,
        "lastPublishedDaysAgo": 21,
        "hasReadme": true,
        "hasRepository": true,
        "maintainerCount": 1,
        "versionCount": 117,
        "isDeprecated": false,
        "unpackedSize": 1300000,
        "license": "MIT",
        "hasInstallScripts": false
      },
      "typosquatOf": null,
      "message": "Package \"lodash\" exists and appears legitimate",
      "registryUrl": "https://www.npmjs.com/package/lodash"
    },
    {
      "name": "reactt",
      "status": "not-found",
      "signals": null,
      "typosquatOf": null,
      "message": "Package \"reactt\" does not exist on the npm registry",
      "registryUrl": "https://www.npmjs.com/package/reactt"
    }
  ]
}
```

### Minimal

```bash
phantom-pkg check lodash reactt lo-dash --format minimal
```

```
not-found    reactt
typosquat    lo-dash
```

Only shows problematic packages by default. Use `--verbose` to show all packages.

```bash
phantom-pkg check lodash reactt --format minimal --verbose
```

```
exists       lodash
not-found    reactt
```

## Programmatic API

```typescript
import { checkPackage, checkPackages, formatReport } from 'phantom-pkg'

// Check a single package
const result = await checkPackage('lodash', { timeout: 5000 })
console.log(result.status)      // 'exists'
console.log(result.signals)     // { weeklyDownloads: 50234567, ... }
console.log(result.typosquatOf) // null

// Check multiple packages at once
const summary = await checkPackages(['lodash', 'reactt', 'lo-dash'], {
  timeout: 5000,
  failOnSuspicious: false,
})
console.log(`${summary.notFound} package(s) not found`)
console.log(`${summary.typosquats} possible typosquat(s)`)

// Format results for display
const report = formatReport(summary, { format: 'table' })
process.stdout.write(report + '\n')
```

### Types

```typescript
type PackageStatus = 'exists' | 'not-found' | 'suspicious' | 'typosquat' | 'error'

interface CheckResult {
  name: string
  status: PackageStatus
  signals: PackageSignals | null
  typosquatOf: string | null
  message: string
  registryUrl: string
}

interface PackageSignals {
  weeklyDownloads: number | null
  publishedDaysAgo: number | null
  lastPublishedDaysAgo: number | null
  hasReadme: boolean
  hasRepository: boolean
  maintainerCount: number | null
  versionCount: number | null
  isDeprecated: boolean
  unpackedSize: number | null
  license: string | null
  hasInstallScripts: boolean
}
```

## How Signals Work

A package is flagged as **suspicious** if *any* of the following are true:

| Signal | Threshold |
|--------|-----------|
| Low downloads + new | < 100 weekly downloads AND published < 30 days ago |
| No maintainers | Zero or unknown maintainer count |
| No metadata | Neither a README nor a repository link |
| Deprecated | Package is marked deprecated on the registry |
| Unavailable count | Weekly download count could not be fetched |
| Install scripts | Has `preinstall`/`install`/`postinstall` AND < 1,000 weekly downloads |

## How Typosquat Detection Works

`phantom-pkg` maintains a list of the 50 most popular npm packages and compares
incoming names against it using four techniques:

1. **Edit distance** — names within 2 character edits are flagged (`lodahs` → `lodash`)
2. **Separator swaps** — hyphens and underscores are interchangeable (`lo_dash` → `lodash`)
3. **Missing or extra hyphens** — `reactdom` is compared against `react-dom`
4. **`js` suffix confusion** — `momentjs` and `moment-js` are compared against `moment`

Exact matches are never flagged — `lodash` is not a typosquat of `lodash`.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | All packages are safe (`exists`) |
| `1`  | One or more packages are `not-found` or `typosquat`; also `suspicious` with `--fail-on-suspicious` |
| `2`  | Fatal error — registry unreachable, file not found, invalid input |

## Shell Integration — Auto-run on `npm install` / `yarn add`

You can wrap the `npm` and `yarn` commands in your shell so `phantom-pkg` runs
automatically before any package is installed. If a package is flagged the
install is aborted.

### PowerShell (Windows)

Add the following to your PowerShell profile (`notepad $PROFILE`):

```powershell
function npm {
    $npmExe = (Get-Command npm -CommandType Application | Select-Object -First 1).Source

    if ($args[0] -in @('install', 'i') -and $args.Count -gt 1) {
        $packages = $args[1..($args.Count - 1)] | Where-Object { $_ -notmatch '^-' }

        if ($packages) {
            Write-Host "Running phantom-pkg check..." -ForegroundColor Cyan
            phantom-pkg check @packages --fail-on-suspicious
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Aborted. Fix the issues above or run npm directly to bypass." -ForegroundColor Red
                return
            }
        }
    }

    & $npmExe @args
}

function yarn {
    $yarnExe = (Get-Command yarn -CommandType Application | Select-Object -First 1).Source

    if ($args[0] -eq 'add' -and $args.Count -gt 1) {
        $packages = $args[1..($args.Count - 1)] | Where-Object { $_ -notmatch '^-' }

        if ($packages) {
            Write-Host "Running phantom-pkg check..." -ForegroundColor Cyan
            phantom-pkg check @packages --fail-on-suspicious
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Aborted. Fix the issues above or run yarn directly to bypass." -ForegroundColor Red
                return
            }
        }
    }

    & $yarnExe @args
}
```

Reload your profile:

```powershell
. $PROFILE
```

### bash / zsh (macOS & Linux)

Add the following to `~/.bashrc` or `~/.zshrc`:

```bash
npm() {
  if [[ "$1" =~ ^(install|i)$ ]] && [[ $# -gt 1 ]]; then
    packages=()
    for arg in "${@:2}"; do
      [[ "$arg" == -* ]] || packages+=("$arg")
    done
    if [[ ${#packages[@]} -gt 0 ]]; then
      phantom-pkg check "${packages[@]}" --fail-on-suspicious || return 1
    fi
  fi
  command npm "$@"
}

yarn() {
  if [[ "$1" == "add" ]] && [[ $# -gt 1 ]]; then
    packages=()
    for arg in "${@:2}"; do
      [[ "$arg" == -* ]] || packages+=("$arg")
    done
    if [[ ${#packages[@]} -gt 0 ]]; then
      phantom-pkg check "${packages[@]}" --fail-on-suspicious || return 1
    fi
  fi
  command yarn "$@"
}
```

Reload:

```bash
source ~/.bashrc   # or source ~/.zshrc
```

### How it behaves

| Command | Behaviour |
|---------|-----------|
| `npm install lodash axios` | phantom-pkg checks both → proceeds if safe |
| `npm install lodahs` | phantom-pkg flags TYPOSQUAT → **aborted** |
| `npm install` | No packages specified → skipped, installs from `package.json` normally |
| `npm ci` | Not intercepted — runs directly |

To bypass the wrapper when you know what you're doing:

```powershell
# PowerShell
& (Get-Command npm -CommandType Application).Source install <package>
```

```bash
# bash / zsh
command npm install <package>
```

## Configuration File

Instead of repeating CLI flags on every run, put your defaults in a config file.
`phantom-pkg` reads config from two places (project-level only, in priority order):

### Option A — `package.json` key (recommended, no extra file)

```json
{
  "phantom-pkg": {
    "ignore": ["@mycompany/*", "@internal/*", "private-*"],
    "failOnSuspicious": true,
    "timeout": 8000,
    "format": "table"
  }
}
```

### Option B — `.phantomrc.json` (standalone config file)

```json
{
  "ignore": ["@mycompany/*", "@internal/*", "private-*"],
  "failOnSuspicious": true,
  "timeout": 8000,
  "format": "table"
}
```

### Supported config fields

| Field              | Type                          | Description                                      |
|--------------------|-------------------------------|--------------------------------------------------|
| `ignore`           | `string[]`                    | Glob patterns for packages to skip               |
| `failOnSuspicious` | `boolean`                     | Exit code 1 if any suspicious packages found     |
| `timeout`          | `number`                      | Registry request timeout in ms                   |
| `format`           | `"table" \| "json" \| "minimal"` | Default output format                         |

### Priority order

CLI flags always win. Ignore lists are **merged** (config + CLI combined):

```bash
# .phantomrc.json has ignore: ["@mycompany/*"]
# This adds "extra-*" on top — both lists apply
phantom-pkg check --file package.json --ignore "extra-*"
```

```
Checked 10 packages: 8 safe, 1 suspicious, 1 not found (3 ignored)
```

### Programmatic API

```typescript
import { loadConfig, mergeConfig, checkPackages } from 'phantom-pkg'

const fileConfig = await loadConfig(process.cwd())
const options = mergeConfig(fileConfig, { verbose: true }, new Set())
const summary = await checkPackages(['lodash', 'axios'], options)
```

## Internal & Private Packages

### Ignoring internal packages with `--ignore`

Use `--ignore` to skip packages that live on a private registry or are otherwise
internal. The flag accepts glob patterns and can be repeated:

```bash
# Skip all packages in your company scope
phantom-pkg check --file package.json --ignore "@mycompany/*"

# Skip multiple scopes and a name prefix
phantom-pkg check --file package.json --ignore "@mycompany/*" --ignore "@internal/*" --ignore "private-*"
```

Ignored packages are excluded from all checks and listed in the summary:

```
Checked 8 packages: 6 safe, 1 suspicious, 1 not found (3 ignored)
```

### Auto-detecting private registries via `.npmrc`

`phantom-pkg` reads your project's `.npmrc` (and `~/.npmrc`) automatically and
routes each package to the correct registry — no extra configuration needed.

```ini
# .npmrc
registry=https://registry.npmjs.org
@mycompany:registry=https://npm.mycompany.com
@another-scope:registry=https://npm.another.com
```

With the above `.npmrc`:

- `@mycompany/utils` → checked against `https://npm.mycompany.com`
- `@another-scope/lib` → checked against `https://npm.another.com`
- `lodash`, `axios`, etc. → checked against the public npm registry

Packages on a private registry are checked for existence and basic metadata
signals but **download counts and typosquat detection are skipped** (private
packages won't appear in public npm download stats).

### Programmatic API

```typescript
import { checkPackages } from 'phantom-pkg'

const summary = await checkPackages(
  ['lodash', '@mycompany/utils', 'axios'],
  {
    ignore: ['@mycompany/*'],   // skip internal packages
    cwd: process.cwd(),         // where to look for .npmrc (default: cwd)
  }
)
```

## CI Integration

```yaml
# .github/workflows/dependency-check.yml
- name: Validate dependencies
  run: phantom-pkg check --file package.json --fail-on-suspicious
```

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `npm test` to ensure all tests pass
5. Run `npm run typecheck` to confirm zero TypeScript errors
6. Submit a pull request

## License

MIT
