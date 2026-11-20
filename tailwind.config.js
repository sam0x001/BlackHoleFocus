/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Black Hole theme
        blackhole: {
          bg: '#030308',
          card: 'rgba(15, 15, 25, 0.65)',
          accent: '#7dd3fc',
          glow: '#38bdf8',
        },
        // Killua theme
        killua: {
          bg: '#0a0a12',
          card: 'rgba(30, 20, 50, 0.6)',
          accent: '#c084fc',
          glow: '#a855f7',
          secondary: '#e0e7ff',
        },
        // Spider-Man 2099 theme
        spiderman: {
          bg: '#050510',
          card: 'rgba(10, 15, 40, 0.65)',
          accent: '#3b82f6',
          glow: '#ef4444',
          secondary: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Manrope Variable', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        }
      }
    },
  },
  plugins: [],
}
