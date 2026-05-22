/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        woodland: {
          bg: '#F1EDE6',
          surface: '#E7E5DA',
          'surface-2': '#DDE2D2',
          border: '#C8D0BB',
          primary: '#3F5A3A',
          'primary-hover': '#2F4A2A',
          accent: '#7E9269',
          'accent-soft': '#A8B998',
          ink: '#2A2E26',
          muted: '#6F7568',
          subtle: '#A0A697',
          danger: '#9C4A3A',
          warning: '#B58A3B',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(42, 46, 38, 0.06), 0 1px 0 rgba(42, 46, 38, 0.04)',
        card: '0 2px 6px rgba(42, 46, 38, 0.07), 0 1px 2px rgba(42, 46, 38, 0.05)',
      },
    },
  },
  plugins: [],
};
