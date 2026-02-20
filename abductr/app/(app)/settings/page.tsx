'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TopNav } from '@/components/TopNav'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { User, Shield, Database } from 'lucide-react'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email)
    })
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('🔐 Encryption key updated'); setNewPassword('') }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg">
          <h1 className="text-2xl font-black text-white tracking-[0.1em] uppercase mb-6"
            style={{ fontFamily: 'Orbitron, var(--font-display), monospace' }}>
            Ship Settings
          </h1>

          {/* Account section */}
          <div className="glass-card rounded-xl p-6 mb-4">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
              style={{ color: '#c026d3', fontFamily: 'Orbitron, monospace' }}>
              <User size={14} /> Commander Profile
            </h2>
            <div className="mb-4">
              <label className="block text-xs text-[#64748b] uppercase tracking-wider mb-2">Email</label>
              <input className="alien-input" value={email} disabled />
            </div>
          </div>

          {/* Password */}
          <div className="glass-card rounded-xl p-6 mb-4">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
              style={{ color: '#22d3ee', fontFamily: 'Orbitron, monospace' }}>
              <Shield size={14} /> Update Encryption Key
            </h2>
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-[#64748b] mb-2">New Password</label>
                <input className="alien-input" type="password" placeholder="New password (min 6 chars)"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={saving} className="btn-cyan text-xs">
                {saving ? 'Updating...' : '🔐 Update Password'}
              </button>
            </form>
          </div>

          {/* DB Info */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
              style={{ color: '#a3e635', fontFamily: 'Orbitron, monospace' }}>
              <Database size={14} /> Mothership Database
            </h2>
            <div className="space-y-2 text-xs text-[#64748b]">
              <div className="flex justify-between">
                <span>Supabase URL</span>
                <span className="text-[#475569] font-mono truncate max-w-[200px]">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0]}...supabase.co
                </span>
              </div>
              <div className="flex justify-between">
                <span>Database</span>
                <span className="text-[#a3e635]">Connected ✓</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
