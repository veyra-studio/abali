// Template for projects: vendors a Veyra Core release into vendor/veyra-core.
// Copied into each project as scripts/engine-update.mjs.
//
//   node scripts/engine-update.mjs [path/to/veyra-core-x.y.z.tgz]
//
// Without an argument, uses the newest tarball in ../veyra-core/release/.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const project = resolve(dirname(new URL(import.meta.url).pathname), '..')
let tarball = process.argv[2] && resolve(process.argv[2])
if (!tarball) {
  const dir = resolve(project, '../veyra-core/release')
  if (!existsSync(dir)) {
    console.error(`No tarball given and ${dir} does not exist. Run "npm run release:pack" in veyra-core first.`)
    process.exit(1)
  }
  const versions = readdirSync(dir).filter((f) => /^veyra-core-\d+\.\d+\.\d+.*\.tgz$/.test(f))
  versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (!versions.length) {
    console.error(`No veyra-core-*.tgz in ${dir}`)
    process.exit(1)
  }
  tarball = join(dir, versions.at(-1))
}

const target = join(project, 'vendor/veyra-core')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
execFileSync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'])

const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
let commit = null
try {
  commit = execFileSync('git', ['-C', dirname(dirname(tarball)), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {}
const meta = {
  name: pkg.name,
  version: pkg.version,
  tarball: tarball.split('/').at(-1),
  sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
  sourceCommit: commit,
  vendoredAt: new Date().toISOString(),
}
writeFileSync(join(target, 'VENDORED.json'), JSON.stringify(meta, null, 2) + '\n')

// CI installs the engine from this folder, so every vendored file must be
// committable. A bare "dist/" in .gitignore also matches vendor/veyra-core/dist.
let ignored = []
try {
  ignored = execFileSync('git', ['-C', project, 'ls-files', '--others', '--ignored', '--exclude-standard', '--', 'vendor/veyra-core'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
} catch {}
if (ignored.length) {
  console.error(`${ignored.length} vendored file(s) are gitignored and would be missing in CI (e.g. ${ignored[0]}).`)
  console.error('Anchor build-output patterns in .gitignore to the project root ("/dist/", not "dist/").')
  process.exit(1)
}

console.log(`Vendored ${pkg.name}@${pkg.version} into vendor/veyra-core`)
execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: project, stdio: 'inherit' })
