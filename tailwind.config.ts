import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './app/**/*.{ts,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: { display: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
      colors: {
        accent: '#667eea'
      }
    }
  },
  plugins: []
}

export default config
