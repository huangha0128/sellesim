/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        'PingFang SC',
        'HarmonyOS Sans SC',
        'Segoe UI',
        'sans-serif',
      ],
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4050C0',
          bright: '#5050D0',
          deep: '#3030A0',
          sky: '#6CD5FA',
          light: '#E4EAFF',
          lighter: '#F0F3FF',
        },
        ink: {
          DEFAULT: '#1A1D3A',
          2: '#4A5078',
          3: '#8B90B0',
        },
        surface: {
          page: '#F5F7F8',
          card: '#FFFFFF',
          soft: '#EEF0FF',
        },
        line: '#E1E8EC',
      },
      borderRadius: {
        sm: '16px',
        md: '24px',
        lg: '32px',
        xl: '44px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(32, 32, 136, 0.08)',
        float: '0 12px 40px rgba(32, 32, 136, 0.12)',
      },
    },
  },
  plugins: [],
};