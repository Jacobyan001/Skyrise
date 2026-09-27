/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"VT323"', 'monospace'],
      },
      colors: {
        'pixel-bg': '#f0f0f0',
        'pixel-dark': '#2d2d2d',
        'pixel-primary': '#3b82f6',
        'pixel-accent': '#f59e0b',
        'pixel-danger': '#ef4444',
        'pixel-success': '#10b981',
      },
      boxShadow: {
        'pixel': '4px 4px 0px 0px rgba(0,0,0,1)',
        'pixel-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '10%': { opacity: '0.3' },
          '90%': { opacity: '0.3' },
          '100%': { transform: 'translateY(-100px)', opacity: '0' },
        },
        shine: {
          '0%': { transform: 'translateX(-150%) skewX(-12deg)' },
          '100%': { transform: 'translateX(200%) skewX(-12deg)' },
        },
        construction: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        swingIn: {
          '0%': { transform: 'rotateX(-100deg)', transformOrigin: 'top', opacity: '0' },
          '100%': { transform: 'rotateX(0deg)', transformOrigin: 'top', opacity: '1' },
        },
      },
      animation: {
        float: 'float 8s infinite linear',
        'shine-once': 'shine 1.5s ease-out forwards',
        'construction-scroll': 'construction 2s linear infinite',
        'swing-in-top-fwd': 'swingIn 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
