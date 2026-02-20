'use client'
import Link from 'next/link'
import { UfoIcon } from './UfoIcons'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  href?: string
}

export function AbductrLogo({ size = 'md', showTagline = false, href = '/dashboard' }: LogoProps) {
  const sizes = {
    sm: { ufo: 28, title: 'text-lg', tagline: 'text-[9px]' },
    md: { ufo: 38, title: 'text-2xl', tagline: 'text-[10px]' },
    lg: { ufo: 56, title: 'text-4xl', tagline: 'text-xs' },
  }

  const s = sizes[size]

  const content = (
    <div className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <UfoIcon size={s.ufo} animate={true} />
        {/* Glow under UFO */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: s.ufo * 0.8,
            height: 6,
            background: 'radial-gradient(ellipse at center, rgba(192,38,211,0.6) 0%, transparent 70%)',
            filter: 'blur(4px)',
          }}
        />
      </div>
      <div>
        <div
          className={`font-bold tracking-[0.18em] text-white group-hover:text-[#c026d3] transition-colors ${s.title}`}
          style={{ fontFamily: 'var(--font-display, Orbitron), sans-serif' }}
        >
          ABDUCTR
        </div>
        {showTagline && (
          <div className={`text-[#64748b] tracking-[0.1em] uppercase mt-0.5 ${s.tagline}`}
            style={{ fontFamily: 'var(--font-mono, Space Mono), monospace' }}>
            Abducting B2B Leads from Planet Earth
          </div>
        )}
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
