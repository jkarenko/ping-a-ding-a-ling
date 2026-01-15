/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color palette for the app
        ping: {
          good: '#22c55e', // green-500
          warning: '#eab308', // yellow-500
          bad: '#ef4444', // red-500
        },
      },
      animation: {
        'flash-border': 'flash-border 500ms ease-out forwards',
      },
      keyframes: {
        'flash-border': {
          '0%': {
            boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.8)',
          },
          '100%': {
            boxShadow: '0 0 0 4px rgba(239, 68, 68, 0)',
          },
        },
      },
    },
  },
  plugins: [],
};
