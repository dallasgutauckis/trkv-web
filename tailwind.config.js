/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#9146FF',
        secondary: '#772CE8',
        background: '#0E0E10',
        surface: '#18181B',
        text: '#EFEFF1',
        muted: '#8E8E8E',
      },
    },
  },
  plugins: [],
}

