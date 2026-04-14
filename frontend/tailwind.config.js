/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // ANTIVAXXER brand colors — from v9 mock CSS variables
      colors: {
        'av-black': '#0B0B0B',
        'av-bone': '#E8E5DD',
        'av-gunmetal': '#2C2F33',
        'av-red': '#6A0E0E',
        'av-red-hover': '#8A1A1A',
        'av-gold': '#D4A84B',
        'av-bone-muted': 'rgba(232, 229, 221, 0.5)',
        'av-bone-dim': 'rgba(232, 229, 221, 0.15)',
        'av-bone-faint': 'rgba(232, 229, 221, 0.08)',
      },
      fontFamily: {
        'heading': ['"Bebas Neue"', 'sans-serif'],
        'body': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        'condensed': ['"Barlow Condensed"', 'sans-serif'],
      },
      // Screen reader only utility (for ADA accessibility)
      // Usage: className="sr-only" or "focus:not-sr-only"
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
