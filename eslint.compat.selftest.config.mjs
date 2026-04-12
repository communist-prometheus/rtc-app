// Self-test config for the baseline linter.
// Points eslint-plugin-compat at a fixture file that uses a
// non-baseline API (`navigator.gpu`). The lint:compat:self-test script
// runs this config and asserts the exit code is non-zero — if the
// linter stops flagging this, the guardrail is broken.

import compat from 'eslint-plugin-compat'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['__tests__/baseline-violation.fixture.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    plugins: { compat },
    settings: { lintAllEsApis: true, polyfills: [] },
    rules: { 'compat/compat': 'error' },
  },
]
