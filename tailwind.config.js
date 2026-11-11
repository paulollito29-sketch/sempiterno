/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: '#FAF8F5',
        bone: '#FAF8F5',
        night: '#0F1015',
        nightSurface: '#181A20',
        nightCard: '#20222A',
        carbon: '#1C1917',
        terracotta: '#E17068',
        blush: '#F4A5A5',
        coral: {
          DEFAULT: '#E17068',
          hover: '#D45C54',
          light: '#F4A5A5',
          dark: '#C04840',
        },
        rosePastel: {
          DEFAULT: '#F4A5A5',
          light: '#FCE7E7',
          dark: '#E17068',
        },
        butter: {
          DEFAULT: '#FDE68A',
          light: '#FEF3C7',
          dark: '#FCD34D',
        },
        sage: '#D7ECD9',
        skyNeo: '#BEE1E6',
        lavender: '#E2D4F0',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'neo-sm': '2px 2px 0px #181B23',
        'neo': '4px 4px 0px #181B23',
        'neo-lg': '6px 6px 0px #181B23',
        'neo-xl': '8px 8px 0px #181B23',
        'neo-dark-sm': '2px 2px 0px #FFFDF7',
        'neo-dark': '4px 4px 0px #FFFDF7',
        'neo-dark-coral': '4px 4px 0px #FF6E61',
        'neo-dark-butter': '4px 4px 0px #FDE68A',
      },
      borderRadius: {
        'neo': '16px',
      }
    },
  },
  plugins: [],
}
