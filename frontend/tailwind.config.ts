import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--bg-page)',
          panel: 'var(--bg-panel)',
          border: 'var(--border-panel)',
          text: 'var(--text-primary)',
          muted: 'var(--text-app-muted)',
          soft: 'var(--text-app-soft)'
        },
        req: 'var(--chart-req)',
        edi: 'var(--chart-edi)',
        inv: 'var(--chart-inv)',
        critical: 'var(--anomaly-critical)',
        warning: 'var(--anomaly-warning)',
        live: '#4caf50',
        // dt-* aliases — used to replace hardcoded bg-[#...] Tailwind classes
        'dt-page':        'var(--bg-page)',
        'dt-panel':       'var(--bg-panel)',
        'dt-panel-hover': 'var(--bg-panel-hover)',
        'dt-sunken':      'var(--bg-sunken)',
        'dt-elevated':    'var(--bg-elevated)',
        'dt-border':      'var(--border-panel)',
        'dt-subtle':      'var(--border-subtle)'
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        glow: 'var(--shadow-glow)'
      },
      gridTemplateColumns: {
        dashboard: '1fr minmax(0, 2fr) minmax(0, 2fr) 1fr'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        pulseDot: 'pulseDot 1.8s ease-in-out infinite'
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.55' }
        }
      }
    }
  },
  plugins: []
} satisfies Config;