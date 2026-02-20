'use client'
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Zap, LogOut, Mail } from 'lucide-react'
import { AlienHeadIcon } from './UfoIcons'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TopNavProps {
  onNewLead?: () => void
  onSearch?: (q: string) => void
}

export function TopNav({ onNewLead, onSearch }: TopNavProps) {
  const [searchVal, setSearchVal] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const handleSearch = useCallback((v: string) => {
    setSearchVal(v)
    onSearch?.(v)
  }, [onSearch])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Beam-out successful. Safe travels, Earthling.')
    router.push('/')
  }

  return (
    <header
      className="flex items-center gap-4 px-6 h-14 flex-shrink-0"
      style={{
        background: 'rgba(10,10,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#64748b' }}
        />
        <input
          className="alien-input pl-9 text-sm h-8"
          placeholder="Search the database..."
          value={searchVal}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ height: '32px', padding: '0 0.75rem 0 2.2rem' }}
        />
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button onClick={onNewLead} className="btn-ghost text-xs h-8 px-3">
          <Plus size={14} />
          New Lead
        </button>

        <Link href="/pipeline">
          <button className="btn-cyan text-xs h-8 px-3 py-0">
            <Zap size={13} />
            Pipeline
          </button>
        </Link>

        <Link href="/url-scraper">
          <button className="btn-cyan text-xs h-8 px-3 py-0">
            <Mail size={13} />
            Harvest Emails
          </button>
        </Link>

        <Link href="/abduction">
          <button className="btn-plasma text-xs h-8 px-3 py-0">
            <Zap size={14} />
            Abduct Leads
          </button>
        </Link>

        {/* Avatar menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-white/5"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(192,38,211,0.15)',
                border: '1px solid rgba(192,38,211,0.3)',
              }}
            >
              <AlienHeadIcon size={16} />
            </div>
          </button>

          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-10 glass-card rounded-lg py-1 min-w-[150px] z-50"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all"
              >
                <LogOut size={14} />
                Beam Out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  )
}
