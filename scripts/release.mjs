#!/usr/bin/env node
// Publish a new version. Her installed app picks it up automatically (see src/lib/useUpdater.ts).
//
//   npm run release                      # 0.2.0 -> 0.2.1
//   npm run release -- minor "New: …"    # 0.2.1 -> 0.3.0, with release notes
//   npm run release -- 1.0.0             # explicit version
//
// Needs: the updater signing key at ~/.tauri/timetable.key (or its contents in TAURI_SIGNING_PRIVATE_KEY),
// `gh` logged in (or GH_TOKEN), clean git tree on main, and rustup with the x86_64-apple-darwin +
// aarch64-apple-darwin targets, because releases are universal builds (her Mac is Intel). On Max's Mac that's
// Homebrew's keg-only rustup (Homebrew's own `rust` can't cross-compile); on GitHub's Mac runners it's on PATH.
//
// The same script runs remotely from .github/workflows/release.yml (GitHub → Actions → Release → Run workflow).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REPO = 'maxsalmon1999-cloud/timetable'
const KEY = path.join(os.homedir(), '.tauri', 'timetable.key')
const root = path.resolve(import.meta.dirname, '..')
const at = (p) => path.join(root, p)

// use rustup's toolchain (keg-only in Homebrew, so not on PATH by default; GitHub's runners have it on PATH)
const RUSTUP_BIN = '/opt/homebrew/opt/rustup/bin'
const PATH = fs.existsSync(RUSTUP_BIN) ? `${RUSTUP_BIN}:${process.env.PATH}` : process.env.PATH
const run = (cmd, env) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, PATH, ...env } })
const out = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH } }).trim()
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

const [bump = 'patch', notes = ''] = process.argv.slice(2)

// ---- preflight ----
const signingKey = process.env.TAURI_SIGNING_PRIVATE_KEY || (fs.existsSync(KEY) ? fs.readFileSync(KEY, 'utf8') : '')
if (!signingKey)
  fail(`Update signing key missing (${KEY}, or the TAURI_SIGNING_PRIVATE_KEY secret on GitHub). Restore it from your backup; see STATUS.md.`)
if (out('git status --porcelain')) fail('Commit your changes before releasing.')
if (out('git rev-parse --abbrev-ref HEAD') !== 'main') fail('Releases are made from the main branch.')
// on GitHub Actions gh uses the workflow's GH_TOKEN, which `gh auth status` can't always describe
if (!process.env.GH_TOKEN)
  try {
    out('gh auth status')
  } catch {
    fail('The GitHub CLI is not logged in (run: gh auth login).')
  }
try {
  out('rustup --version')
} catch {
  fail('rustup not found (brew install rustup). Needed for the Intel + Apple Silicon build.')
}
const targets = out('rustup target list --installed')
for (const t of ['x86_64-apple-darwin', 'aarch64-apple-darwin'])
  if (!targets.includes(t)) fail(`Rust target ${t} missing (run: rustup target add ${t})`)

// ---- version ----
const confPath = at('src-tauri/tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'))
const current = conf.version
let next
if (/^\d+\.\d+\.\d+$/.test(bump)) next = bump
else {
  const [maj, min, pat] = current.split('.').map(Number)
  next = { major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[bump]
  if (!next) fail(`Unknown bump "${bump}" (use patch, minor, major or x.y.z)`)
}
console.log(`\n→ Releasing Timetable ${current} → ${next}\n`)

const versioned = ['src-tauri/tauri.conf.json', 'package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']
conf.version = next
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n')
run(`npm version ${next} --no-git-tag-version --allow-same-version`)
const cargoPath = at('src-tauri/Cargo.toml')
fs.writeFileSync(cargoPath, fs.readFileSync(cargoPath, 'utf8').replace(/^version = ".*"$/m, `version = "${next}"`))

// ---- build + sign ----
try {
  run('npx tauri build --target universal-apple-darwin', { TAURI_SIGNING_PRIVATE_KEY: signingKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' })
} catch {
  run(`git checkout -- ${versioned.join(' ')}`)
  fail('Build failed; version bump undone.')
}

const bundle = at('src-tauri/target/universal-apple-darwin/release/bundle')
const tarball = path.join(bundle, 'macos', 'Timetable.app.tar.gz')
const dmg = path.join(bundle, 'dmg', `Timetable_${next}_universal.dmg`)
for (const f of [tarball, `${tarball}.sig`, dmg]) if (!fs.existsSync(f)) fail(`Expected build output missing: ${f}`)

// stable name so https://github.com/<repo>/releases/latest/download/Timetable.dmg always works
const stableDmg = path.join(bundle, 'dmg', 'Timetable.dmg')
fs.copyFileSync(dmg, stableDmg)

const manifest = path.join(bundle, 'latest.json')
fs.writeFileSync(
  manifest,
  JSON.stringify(
    {
      version: next,
      notes,
      pub_date: new Date().toISOString(),
      // one universal app serves both Intel and Apple Silicon Macs
      platforms: Object.fromEntries(
        ['darwin-x86_64', 'darwin-aarch64'].map((p) => [
          p,
          {
            signature: fs.readFileSync(`${tarball}.sig`, 'utf8').trim(),
            url: `https://github.com/${REPO}/releases/download/v${next}/Timetable.app.tar.gz`,
          },
        ]),
      ),
    },
    null,
    2,
  ),
)

// ---- publish ----
run(`git add ${versioned.join(' ')}`)
run(`git commit -q -m "Release v${next}"`)
run(`git tag v${next}`)
run('git push -q --follow-tags')
const notesFile = path.join(os.tmpdir(), `timetable-notes-${next}.md`)
fs.writeFileSync(notesFile, notes || `Timetable ${next}`)
run(
  `gh release create v${next} --repo ${REPO} --title "Timetable ${next}" --notes-file "${notesFile}" ` +
    [tarball, `${tarball}.sig`, stableDmg, manifest].map((f) => `"${f}"`).join(' '),
)

console.log(`\n✓ Timetable ${next} is live. Installed copies will update themselves within ~6 hours (or on next launch).`)
console.log(`  Fresh install link: https://github.com/${REPO}/releases/latest/download/Timetable.dmg\n`)
