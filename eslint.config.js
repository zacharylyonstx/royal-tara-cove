import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.remember', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Intentionally-unused vars/args/catch bindings are prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // This is a React Three Fiber game. Its particle/FX systems intentionally
      // seed with Math.random() inside useMemo, mutate BufferAttribute arrays in
      // useFrame, and read refs during render — all idiomatic R3F. The new
      // React-Compiler-strict rules in eslint-plugin-react-hooks v7 flag those
      // correct patterns as errors, drowning out real signal. Disable the
      // compiler-only rules; keep the classic hook rules (rules-of-hooks,
      // exhaustive-deps) as errors, and keep occasionally-real ones as warnings.
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
