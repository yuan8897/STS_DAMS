/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          dark: '#1a1f2e',
          light: '#f0f2f5',
        },
        primary: {
          DEFAULT: '#2c3e6b',
          light: '#3d5a99',
          dark: '#1a2745',
        },
        accent: {
          purple: '#7c5ce0',
          pink: '#e08585',
        },
        session: {
          matching: '#5b8def',
          locked: '#f0a050',
          progress: '#50c878',
          completed: '#888888',
        },
      },
      fontSize: {
        '3xs': ['0.688rem', { lineHeight: '1rem' }],   // ~11px
        '2xs': ['0.75rem', { lineHeight: '1rem' }],     // ~12px
      },
      fontFamily: {
        sans: [
          'PingFang SC',
          'Microsoft YaHei',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
