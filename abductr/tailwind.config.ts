import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'sans-serif'],
      },
      colors: {
        void: '#0a0a0f',
        nebula: '#0d0d1a',
        plasma: '#c026d3',
        cyan: {
          DEFAULT: '#22d3ee',
          400: '#22d3ee',
          500: '#06b6d4',
        },
        lime: {
          DEFAULT: '#a3e635',
          400: '#a3e635',
        },
        ufo: {
          glow: 'rgba(192,38,211,0.4)',
          beam: 'rgba(34,211,238,0.3)',
        },
      },
      animation: {
        'bob': 'bob 4s ease-in-out infinite',
        'beam-pulse': 'beamPulse 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'star-twinkle': 'twinkle 3s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        beamPulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scaleX(0.9)' },
          '50%': { opacity: '0.8', transform: 'scaleX(1.05)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(192,38,211,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(192,38,211,0.7), 0 0 60px rgba(34,211,238,0.3)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        scan: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(1deg)' },
          '66%': { transform: 'translateY(4px) rotate(-1deg)' },
        },
      },
      backgroundImage: {
        'space-gradient': 'radial-gradient(ellipse at center, #0d0d1a 0%, #0a0a0f 100%)',
        'plasma-gradient': 'linear-gradient(135deg, #c026d3, #22d3ee)',
        'beam-gradient': 'linear-gradient(180deg, rgba(34,211,238,0.8) 0%, rgba(34,211,238,0) 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      },
      boxShadow: {
        'plasma': '0 0 20px rgba(192,38,211,0.5), 0 0 60px rgba(192,38,211,0.2)',
        'cyan': '0 0 20px rgba(34,211,238,0.5), 0 0 60px rgba(34,211,238,0.2)',
        'lime': '0 0 20px rgba(163,230,53,0.5)',
        'card': '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
