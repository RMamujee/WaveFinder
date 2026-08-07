/**
 * Write each spot's bottom type into the seed as an explicit field.
 *
 * `bottomType` was regex-guessed from the description on every request, so
 * 0 of 1,490 spots had a stored value and editing marketing copy silently
 * changed a spot's tide scoring. This runs the (corrected) inference once and
 * commits the answer; `lib/bottom-type.ts` then only exists to classify newly
 * added spots and the transitional Postgres rows.
 *
 *   npx tsx scripts/backfill-bottom-type.ts           # dry run, prints the diff
 *   npx tsx scripts/backfill-bottom-type.ts --write   # insert/update the field
 *
 * Re-running is safe: an existing `bottomType` line is replaced, not doubled.
 * Values are only ever inserted, never removed — a hand-corrected entry that
 * disagrees with the regex is reported and left alone unless --overwrite.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inferBottomType } from '../lib/bottom-type'

const SEED_FILES = [
  'lib/spots-data.ts',
  'lib/spots/asia-indian-ocean.ts',
  'lib/spots/australia-nz.ts',
  'lib/spots/east-coast.ts',
  'lib/spots/europe-atlantic.ts',
  'lib/spots/europe-med-africa.ts',
  'lib/spots/hawaii-gulf-lakes-carib.ts',
  'lib/spots/mexico-central-america.ts',
  'lib/spots/pacific-islands.ts',
  'lib/spots/pnw-alaska.ts',
  'lib/spots/south-america.ts',
]

const BOTTOM_LINE = /^\s*bottomType: '([^']+)',\s*$/

/**
 * Rewrite one seed file, keyed off the object literal boundaries.
 *
 * Each spot is a flat `  { … },` block. Any existing `bottomType` line is
 * stripped first and the fresh one written immediately after
 * `facingDirection`, which every record has exactly once. Stripping before
 * inserting (rather than editing in place) is what makes a re-run idempotent:
 * the stored value sits *after* the insertion point, so a single streaming
 * pass would emit a second line beside the one it had not read yet.
 */
function processFile(path: string, write: boolean, overwrite: boolean) {
  const raw = readFileSync(path, 'utf8').split(/\r?\n/)

  // Pass 1 — lift out the stored values, indexed by the block they belong to.
  const lines: string[] = []
  const storedByBlock = new Map<number, string>()
  let block = -1
  for (const line of raw) {
    if (/^\s*\{\s*$/.test(line)) block++
    const stored = BOTTOM_LINE.exec(line)
    if (stored && block >= 0) { storedByBlock.set(block, stored[1]); continue }
    lines.push(line)
  }

  // Pass 2 — classify and re-insert.
  const out: string[] = []
  const counts = new Map<string, number>()
  let name = ''
  let description = ''
  let conflicts = 0
  let inserted = 0
  block = -1

  for (const line of lines) {
    if (/^\s*\{\s*$/.test(line)) { block++; name = ''; description = '' }

    const nameMatch = /^\s*name: (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),\s*$/.exec(line)
    if (nameMatch) name = nameMatch[1] ?? nameMatch[2] ?? ''
    // Descriptions wrap across lines; collect every quoted fragment on a line
    // that either opens the field or continues it, rather than assuming one.
    if (/^\s*description:/.test(line) || /^\s*(?:'|")/.test(line)) {
      for (const m of line.matchAll(/(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
        const frag = m[1] ?? m[2] ?? ''
        if (frag.length > 12) description += ' ' + frag
      }
    }

    out.push(line)

    const facing = /^(\s*)facingDirection: .+,\s*$/.exec(line)
    if (!facing || block < 0) continue
    const guess = inferBottomType(description, name)
    const stored = storedByBlock.get(block) ?? null
    const value = stored && !overwrite ? stored : guess
    if (stored && stored !== guess) conflicts++
    if (!stored) inserted++
    out.push(`${facing[1]}bottomType: '${value}',`)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  if (write) writeFileSync(path, out.join('\n'))
  return { counts, conflicts, inserted }
}

function main() {
  const write = process.argv.includes('--write')
  const overwrite = process.argv.includes('--overwrite')
  const total = new Map<string, number>()
  let conflicts = 0
  let inserted = 0

  for (const file of SEED_FILES) {
    const r = processFile(file, write, overwrite)
    for (const [k, v] of r.counts) total.set(k, (total.get(k) ?? 0) + v)
    conflicts += r.conflicts
    inserted += r.inserted
  }

  const sum = [...total.values()].reduce((a, b) => a + b, 0)
  console.log(`${sum} spots · ${inserted} newly classified · ${conflicts} disagree with a stored value (kept${overwrite ? ' — OVERWRITTEN' : ''})`)
  console.log([...total].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k.padEnd(6)} ${v}`).join('\n'))
  if (!write) console.log('\ndry run — pass --write to apply')
}

main()
