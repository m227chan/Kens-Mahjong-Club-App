import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off'
    }
  },
  globalIgnores([
    '.next/**',
    '.next-dev/**',
    'out/**',
    'functions/lib/**',
    'src/dataconnect-generated/**',
    'src/dataconnect-admin-generated/**',
    'next-env.d.ts'
  ])
])
