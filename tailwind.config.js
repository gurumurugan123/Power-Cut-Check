/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f4f7f6',
          100: '#e3ebe8',
          200: '#c5d5cf',
          700: '#2d4a42',
          800: '#1e332d',
          900: '#142420',
          950: '#0b1613',
        },
        ember: {
          400: '#f0a060',
          500: '#e07a3a',
          600: '#c45d22',
          700: '#a34a1a',
        },
        leaf: {
          400: '#5eb887',
          500: '#3d9a6a',
          600: '#2f7a54',
        },
      },
      boxShadow: {
        glow: '0 12px 40px -12px rgba(196, 93, 34, 0.45)',
      },
    },
  },
  plugins: [],
}
