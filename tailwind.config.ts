import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#3b82f6',
        'brand-cyan': '#22d3ee',
        'brand-emerald': '#10b981',
        'brand-green': '#4ade80',
        'dark-bg': '#0f172a',
        'dark-card': 'rgba(30, 41, 59, 0.7)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'glow-cyan': 'glow-cyan 2s infinite alternate',
        'glow-emerald': 'glow-emerald 2s infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out',
        'zoom-in-95': 'zoomIn95 0.3s ease-out',
        'slide-in-from-top-4': 'slideInTop 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-cyan': {
          'from': { 'box-shadow': '0 0 10px rgba(34, 211, 238, 0.2)' },
          'to': { 'box-shadow': '0 0 25px rgba(34, 211, 238, 0.6)' },
        },
        'glow-emerald': {
          'from': { 'box-shadow': '0 0 10px rgba(16, 185, 129, 0.2)' },
          'to': { 'box-shadow': '0 0 25px rgba(16, 185, 129, 0.6)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        zoomIn95: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        slideInTop: {
          'from': { opacity: '0', transform: 'translateY(-1rem)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
