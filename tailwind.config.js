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
        cream: '#FFFDF7',
        night: '#181B23',
        nightSurface: '#222631',
        nightCard: '#2A2F3D',
        carbon: '#181B23',
        coral: {
          DEFAULT: '#FF6E61',
          hover: '#FA5A4C',
          light: '#FF887D',
          dark: '#E05347',
        },
        rosePastel: {
          DEFAULT: '#FFB5A7',
          light: '#FFD6CE',
          dark: '#F89684',
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
        display: ['"Space Grotesk"', 'sans-serif'],
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
