#!/usr/bin/env node
// Self-test for the baseline browser-support linter.
// Runs eslint against a fixture file that deliberately uses a
// non-baseline Web API (`navigator.gpu`) and asserts the linter flags
// it. Non-zero exit from this script means the guardrail is healthy;
// exit 0 means the linter stopped catching violations and must be
// fixed before the compat gate is trusted.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')

const res = spawnSync(
  'bunx',
  [
    'eslint',
    '--config',
    'eslint.compat.selftest.config.mjs',
    '__tests__/baseline-violation.fixture.ts',
  ],
  { cwd: pkgRoot, stdio: 'pipe', shell: true }
)

const stdout = res.stdout?.toString() ?? ''
const stderr = res.stderr?.toString() ?? ''
const flagged = /compat\/compat/.test(stdout + stderr)

if (flagged) {
  console.log('baseline linter self-test PASSED — non-baseline API caught')
  process.exit(0)
} else {
  console.error(
    'baseline linter self-test FAILED — fixture was not flagged:'
  )
  console.error(stdout)
  console.error(stderr)
  process.exit(1)
}
