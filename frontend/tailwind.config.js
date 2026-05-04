/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Plus Jakarta Sans: moderna, geométrica, ótima legibilidade
        // Substitui Inter (texto), Fraunces (display) e em parte JetBrains (números)
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', '"JetBrains Mono"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Verde-limão refinado (mais saturado, "premium")
        accent: {
          DEFAULT: '#b8e94e',
          light: '#d0f078',
          dark: '#9bc92e',
        },
        // Tons de cinza modernos (não mais "ink" carvão pesado)
        ink: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        positive: '#10b981', // verde mais suave
        negative: '#ef4444', // vermelho mais suave
        warn:     '#f59e0b',
      },
      backgroundImage: {
        // Gradientes prontos para uso em cards, botões, fundos
        'gradient-app':     'linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)',
        'gradient-dark':    'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
        'gradient-accent':  'linear-gradient(135deg, #d0f078 0%, #b8e94e 50%, #9bc92e 100%)',
        'gradient-positive':'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
        'gradient-negative':'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
        'gradient-card':    'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
        'gradient-balance': 'linear-gradient(135deg, #18181b 0%, #3f3f46 60%, #27272a 100%)',
      },
      boxShadow: {
        // Sombras suaves modernas (substituem as duras 4px 4px 0 0)
        'soft':       '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'soft-md':    '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'soft-lg':    '0 12px 24px -6px rgb(0 0 0 / 0.10), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        'soft-xl':    '0 20px 40px -12px rgb(0 0 0 / 0.15), 0 8px 16px -8px rgb(0 0 0 / 0.08)',
        'glow-accent':'0 0 0 4px rgb(184 233 78 / 0.18)',
        'inner-soft': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      animation: {
        'slide-up':    'slideUp 0.5s ease-out',
        'fade-in':     'fadeIn 0.3s ease-out',
        'shimmer':     'shimmer 2s linear infinite',
      },
      keyframes: {
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
      },
    },
  },
  plugins: [],
};
