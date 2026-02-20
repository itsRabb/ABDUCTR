'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AbductrLogo } from './AbductrLogo'
import { UfoIcon, AlienHeadIcon, PlanetIcon, TractorBeamIcon } from './UfoIcons'
import { BarChart3, Settings, ChevronLeft, ChevronRight, Mail, Zap } from 'lucide-react'

const navItems = [
  {
    href: '/dashboard',
    label: 'Mission Control',
    icon: <PlanetIcon size={18} />,
    exact: true,
  },
  {
    href: '/abduction',
    label: 'Abduction Bay',
    icon: <TractorBeamIcon size={18} />,
  },
  {
    href: '/pipeline',
    label: 'Email Pipeline',
    icon: <Zap size={18} color="#22d3ee" />,
  },
  {
    href: '/url-scraper',
    label: 'Email Harvester',
    icon: <Mail size={18} color="#22d3ee" />,
  },
  {
    href: '/leads',
    label: 'My Leads',
    icon: <AlienHeadIcon size={18} />,
  },
  {
    href: '/analytics',
    label: 'Intel Report',
    icon: <BarChart3 size={18} color="#22d3ee" />,
  },
  {
    href: '/settings',
    label: 'Ship Settings',
    icon: <Settings size={18} color="#64748b" />,
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        background: 'rgba(10, 10, 15, 0.9)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top: Logo */}
      <div className="px-4 py-5">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <AbductrLogo size="sm" href="/dashboard" />
            </motion.div>
          ) : (
            <motion.div
              key="mini-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center"
            >
              <UfoIcon size={28} animate={true} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="mx-3 mb-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="truncate whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost w-full flex justify-center"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <span className="flex items-center gap-2">
              <ChevronLeft size={16} />
              {!collapsed && <span className="text-xs">Collapse</span>}
            </span>
          )}
        </button>
      </div>

      {/* Plasma line accent */}
      <div
        className="absolute top-0 right-0 h-full w-px pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(192,38,211,0.3), rgba(34,211,238,0.2), transparent)',
        }}
      />
    </motion.aside>
  )
}
