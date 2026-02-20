'use client'
import { motion } from 'framer-motion'

interface UfoProps {
  size?: number
  className?: string
  animate?: boolean
}

export function UfoIcon({ size = 48, className = '', animate = true }: UfoProps) {
  const Wrapper = animate ? motion.div : 'div'

  return (
    <Wrapper
      className={`inline-block relative ${className}`}
      {...(animate
        ? {
            animate: { y: [0, -10, 0] },
            transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          }
        : {})}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tractor beam */}
        <defs>
          <linearGradient id="beamGrad" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="saucerGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="50%" stopColor="#9ca3af" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          <linearGradient id="domeGrad" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Beam */}
        <path
          d="M38 44 L22 78 L62 78 L62 44 Z"
          fill="url(#beamGrad)"
          opacity="0.8"
        />

        {/* Saucer body */}
        <ellipse cx="50" cy="40" rx="32" ry="10" fill="url(#saucerGrad)" />

        {/* Saucer underside glow ring */}
        <ellipse cx="50" cy="40" rx="32" ry="10" fill="none" stroke="#c026d3" strokeWidth="0.8" opacity="0.8" />

        {/* Lights on underside */}
        {[32, 42, 50, 58, 68].map((x, i) => (
          <circle key={i} cx={x} cy={41} r={1.5}
            fill={i % 2 === 0 ? '#c026d3' : '#22d3ee'}
            opacity="0.9"
          />
        ))}

        {/* Dome */}
        <ellipse cx="50" cy="33" rx="16" ry="10" fill="url(#domeGrad)" opacity="0.9" />
        <ellipse cx="50" cy="33" rx="16" ry="10" fill="none" stroke="rgba(147,197,253,0.4)" strokeWidth="0.6" />

        {/* Dome highlight */}
        <ellipse cx="45" cy="29" rx="5" ry="3" fill="rgba(255,255,255,0.35)" />
      </svg>
    </Wrapper>
  )
}

export function AbductionBeam({ width = 120, height = 200 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id="beamFull" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M${width * 0.35} 0 L0 ${height} L${width} ${height} L${width * 0.65} 0 Z`}
        fill="url(#beamFull)"
      />
    </svg>
  )
}

export function AlienHeadIcon({ size = 24, color = '#c026d3' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="12" rx="7" ry="8.5" fill={color} opacity="0.15" stroke={color} strokeWidth="1.2" />
      <ellipse cx="9" cy="11" rx="2" ry="2.5" fill={color} opacity="0.8" />
      <ellipse cx="15" cy="11" rx="2" ry="2.5" fill={color} opacity="0.8" />
      <circle cx="9" cy="11" r="1" fill="#0a0a0f" />
      <circle cx="15" cy="11" r="1" fill="#0a0a0f" />
      <path d="M9 15.5 Q12 17 15 15.5" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.7" />
      <line x1="5" y1="8" x2="3" y2="6" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <line x1="19" y1="8" x2="21" y2="6" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

export function PlanetIcon({ size = 24, color = '#22d3ee' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" fill={color} opacity="0.1" stroke={color} strokeWidth="1.2" />
      <ellipse cx="12" cy="12" rx="11" ry="4" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
      <circle cx="10" cy="10" r="1.5" fill={color} opacity="0.5" />
    </svg>
  )
}

export function TractorBeamIcon({ size = 24, color = '#22d3ee' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="3" fill={color} opacity="0.8" />
      <path d="M8 9 L4 20 L20 20 L16 9 Z" fill={color} opacity="0.15" stroke={color} strokeWidth="1" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="20" stroke={color} strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
    </svg>
  )
}
