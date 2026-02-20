'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { StarfieldBackground } from '@/components/StarfieldBackground'
import { AbductrLogo } from '@/components/AbductrLogo'
import { UfoIcon, AbductionBeam } from '@/components/UfoIcons'
import { Mail, Lock, Zap } from 'lucide-react'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/dashboard')
    })
  }, [router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) throw error
        toast.success('🛸 Magic link sent! Check your email.')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('👽 Account created! Verify your email.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('🚀 Beaming you in...')
        router.replace('/dashboard')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarfieldBackground />

      {/* Corner UFOs */}
      <div className="absolute top-8 right-16 opacity-30 pointer-events-none animate-float">
        <UfoIcon size={64} animate={false} />
      </div>
      <div className="absolute bottom-12 left-12 opacity-20 pointer-events-none" style={{ animation: 'float 9s ease-in-out infinite 2s' }}>
        <UfoIcon size={48} animate={false} />
      </div>
      <div className="absolute top-1/3 right-1/4 opacity-15 pointer-events-none" style={{ animation: 'float 11s ease-in-out infinite 4s' }}>
        <UfoIcon size={36} animate={false} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Hero */}
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex flex-col items-center mb-6">
            <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
              <UfoIcon size={90} animate={false} />
            </motion.div>
            <div className="-mt-2"><AbductionBeam width={120} height={80} /></div>
            <motion.div
              animate={{ y: [10, -5, 10], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-xs font-bold tracking-[0.4em] uppercase -mt-6"
              style={{ color: '#22d3ee', fontFamily: 'Orbitron, var(--font-display), monospace', textShadow: '0 0 20px rgba(34,211,238,0.8)' }}
            >
              LEADS
            </motion.div>
          </div>
          <div className="flex justify-center mb-3">
            <AbductrLogo size="lg" showTagline href="#" />
          </div>
        </motion.div>

        {/* Auth card */}
        <motion.div
          className="glass-card rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          style={{ border: '1px solid rgba(192,38,211,0.25)', boxShadow: '0 0 60px rgba(192,38,211,0.1)' }}
        >
          <div className="h-0.5 -mx-8 -mt-8 mb-8 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #c026d3, #22d3ee, #a3e635)' }} />

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['login', 'signup', 'magic'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs rounded-md transition-all ${mode === m ? 'bg-[#c026d3]/20 text-[#c026d3] border border-[#c026d3]/30' : 'text-[#64748b] hover:text-[#94a3b8]'}`}
                style={{ fontFamily: 'Orbitron, var(--font-display), monospace', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                {m === 'login' ? '🔑 Login' : m === 'signup' ? '👽 Register' : '✉️ Magic Link'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-[#64748b] uppercase tracking-widest mb-2">Transmission Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                <input className="alien-input pl-9" type="email" placeholder="commander@earthbase.mil" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            {mode !== 'magic' && (
              <div>
                <label className="block text-xs text-[#64748b] uppercase tracking-widest mb-2">Encryption Key</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                  <input className="alien-input pl-9" type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-plasma w-full justify-center text-sm py-3.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <UfoIcon size={18} animate={false} />
                  </motion.div>
                  Initiating beam...
                </span>
              ) : (<><Zap size={16} />{mode === 'login' ? 'Beam In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}</>)}
            </button>
          </form>
        </motion.div>

        <motion.p className="text-center text-xs text-[#475569] mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          Powered by Supabase + Puppeteer. Built for B2B outreach.
        </motion.p>
      </div>
    </div>
  )
}