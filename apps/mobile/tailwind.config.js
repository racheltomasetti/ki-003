/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        cream: '#f6f1e6',
        charcoal: '#1a1a1a',
        terra: '#9e2a2b',
        ray: '#efcb68',
        pacific: '#58a4b0',
        sage: '#67934d',
      },
      fontFamily: {
        sans: ['Poppins-Regular'],
        serif: ['Merriweather-Regular'],
      },
    },
  },
  plugins: [],
}
