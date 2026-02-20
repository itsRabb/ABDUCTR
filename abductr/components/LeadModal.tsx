'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { Lead, LeadInsert } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { UfoIcon } from './UfoIcons'

interface LeadModalProps {
  lead?: Lead | null
  open: boolean
  onClose: () => void
  onSaved: (lead: Lead) => void
}

const EMPTY: Partial<LeadInsert> = {
  company_name: '',
  contact_name: '',
  role: '',
  email: '',
  phone: '',
  website: '',
  city: '',
  state: '',
  business_type: '',
  qr_usage: false,
  analytics_present: false,
  estimated_size: undefined,
  budget: undefined,
  authority: false,
  need_level: 3,
  timing: undefined,
  contacted: false,
  date_contacted: undefined,
  channel: undefined,
  response_status: undefined,
  follow_up_date: undefined,
  notes: '',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-[10px] uppercase tracking-[0.2em] mb-3 font-bold"
      style={{ color: '#c026d3', fontFamily: 'var(--font-display, Orbitron), monospace' }}>
      {title}
    </h3>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
)

const Field = ({ label, children, full = false, tip = '' }: { label: string; children: React.ReactNode; full?: boolean; tip?: string }) => (
  <div className={full ? 'col-span-2' : ''}>
    <label className="flex items-center gap-1 text-xs text-[#64748b] mb-1.5">
      {label}
      {tip && (
        <span className="group relative">
          <Info size={11} className="cursor-help text-[#475569]" />
          <span className="invisible group-hover:visible absolute left-0 top-5 z-50 w-52 p-2 rounded-lg text-xs"
            style={{ background: '#0d0d1a', border: '1px solid rgba(192,38,211,0.3)', color: '#94a3b8' }}>
            {tip}
          </span>
        </span>
      )}
    </label>
    {children}
  </div>
)

export function LeadModal({ lead, open, onClose, onSaved }: LeadModalProps) {
  const [form, setForm] = useState<Partial<LeadInsert>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'info' | 'bant' | 'outreach'>('info')

  useEffect(() => {
    if (lead) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...rest } = lead
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(rest)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(EMPTY)
    }
  }, [lead, open])

  const set = (k: keyof LeadInsert, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.company_name?.trim()) {
      toast.error('Company name is required')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const payload = { ...form, updated_at: new Date().toISOString() }

    let result
    if (lead?.id) {
      result = await supabase.from('leads').update(payload).eq('id', lead.id).select().single()
    } else {
      result = await supabase.from('leads').insert(payload).select().single()
    }

    setSaving(false)
    if (result.error) {
      toast.error('Abduction failed: ' + result.error.message)
    } else {
      toast.success(lead?.id ? '📡 Lead updated in the mothership!' : '🛸 Lead abducted successfully!')
      onSaved(result.data as Lead)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: '#0a0a0f',
                border: '1px solid rgba(192,38,211,0.25)',
                boxShadow: '0 0 60px rgba(192,38,211,0.15), 0 25px 60px rgba(0,0,0,0.7)',
                pointerEvents: 'all',
              }}
            >
              {/* Top accent */}
              <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #c026d3, #22d3ee, #a3e635)', opacity: 0.8 }} />

              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0">
                <UfoIcon size={32} animate={false} />
                <div>
                  <h2 className="text-sm font-bold tracking-[0.12em] text-white uppercase"
                    style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                    {lead?.id ? 'Edit Specimen' : 'Log New Contact'}
                  </h2>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    {lead?.company_name || 'New Lead Record'}
                  </p>
                </div>
                <button onClick={onClose} className="ml-auto text-[#64748b] hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-6 flex-shrink-0">
                {(['info', 'bant', 'outreach'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSection(tab)}
                    className={`px-4 py-2 text-xs rounded-t-lg transition-all uppercase tracking-widest ${
                      activeSection === tab
                        ? 'text-[#c026d3] border-b-2 border-[#c026d3]'
                        : 'text-[#64748b] hover:text-[#94a3b8]'
                    }`}
                    style={{ fontFamily: 'var(--font-display, Orbitron), monospace', fontSize: '0.6rem' }}
                  >
                    {tab === 'info' ? '📡 Info' : tab === 'bant' ? '🎯 BANT' : '📬 Outreach'}
                  </button>
                ))}
              </div>

              <div className="h-px mx-6 mb-4" style={{ background: 'rgba(255,255,255,0.07)' }} />

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">

                {/* CONTACT INFO */}
                {activeSection === 'info' && (
                  <>
                    <Section title="Company Info">
                      <Field label="Company Name *" full>
                        <input className="alien-input" placeholder="Acme Corp" value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} />
                      </Field>
                      <Field label="Contact Name">
                        <input className="alien-input" placeholder="John Smith" value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} />
                      </Field>
                      <Field label="Role / Title">
                        <input className="alien-input" placeholder="Owner / Manager" value={form.role || ''} onChange={e => set('role', e.target.value)} />
                      </Field>
                      <Field label="Email">
                        <input className="alien-input" type="email" placeholder="john@acme.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                      </Field>
                      <Field label="Phone">
                        <input className="alien-input" type="tel" placeholder="+1 312 555 0100" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                      </Field>
                      <Field label="Website">
                        <input className="alien-input" placeholder="https://acme.com" value={form.website || ''} onChange={e => set('website', e.target.value)} />
                      </Field>
                      <Field label="City">
                        <input className="alien-input" placeholder="Chicago" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                      </Field>
                      <Field label="State">
                        <input className="alien-input" placeholder="IL" value={form.state || ''} onChange={e => set('state', e.target.value)} />
                      </Field>
                      <Field label="Business Type" full>
                        <input className="alien-input" placeholder="Restaurant, HVAC, Retail..." value={form.business_type || ''} onChange={e => set('business_type', e.target.value)} />
                      </Field>
                    </Section>

                    <Section title="Digital Presence">
                      <Field label="Uses QR Codes" tip="Do they currently use QR codes in marketing?">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.qr_usage ?? false} onChange={e => set('qr_usage', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#c026d3]" />
                          <span className="text-sm text-[#94a3b8]">{form.qr_usage ? 'Yes' : 'No'}</span>
                        </label>
                      </Field>
                      <Field label="Analytics Present" tip="Evidence of Google Analytics/FB Pixel on their site?">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.analytics_present ?? false} onChange={e => set('analytics_present', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#c026d3]" />
                          <span className="text-sm text-[#94a3b8]">{form.analytics_present ? 'Yes' : 'No'}</span>
                        </label>
                      </Field>
                    </Section>
                  </>
                )}

                {/* BANT */}
                {activeSection === 'bant' && (
                  <>
                    {/* BANT Reference Table */}
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="px-4 py-2 text-[10px] uppercase tracking-widest"
                        style={{ background: 'rgba(192,38,211,0.1)', color: '#c026d3', fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                        🎯 BANT Framework Reference
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                            {['Signal', 'Hot (5)', 'Warm (3)', 'Cold (1)'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[#64748b] text-[10px] tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Budget', 'Explicit budget mentioned', 'Implied willingness', 'No budget info'],
                            ['Authority', 'Owner/C-suite', 'Manager/Director', 'Staff/Unknown'],
                            ['Need', 'Clear pain point stated', 'Potential fit identified', 'No obvious need'],
                            ['Timing', 'Immediate need', 'Planning in 90 days', 'No urgency'],
                          ].map(([sig, hot, warm, cold]) => (
                            <tr key={sig} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-3 py-1.5 font-semibold" style={{ color: '#c026d3' }}>{sig}</td>
                              <td className="px-3 py-1.5 text-[#4ade80]">{hot}</td>
                              <td className="px-3 py-1.5 text-[#facc15]">{warm}</td>
                              <td className="px-3 py-1.5 text-[#64748b]">{cold}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Section title="BANT Qualification">
                      <Field label="Estimated Size" tip="Rough size of the company">
                        <select className="alien-select" value={form.estimated_size || ''} onChange={e => set('estimated_size', e.target.value || undefined)}>
                          <option value="">Select…</option>
                          {['Small', 'Medium', 'Large'].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Budget Signal" tip="Perceived budget willingness">
                        <select className="alien-select" value={form.budget || ''} onChange={e => set('budget', e.target.value || undefined)}>
                          <option value="">Select…</option>
                          {['Low', 'Medium', 'High'].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Decision Maker?" tip="Is this person the authority / budget holder?">
                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input type="checkbox" checked={form.authority ?? false} onChange={e => set('authority', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#c026d3]" />
                          <span className="text-sm text-[#94a3b8]">{form.authority ? 'Yes — decision maker' : 'No / Unknown'}</span>
                        </label>
                      </Field>
                      <Field label={`Need Level: ${form.need_level ?? 3}/5`} tip="1 = no need, 5 = urgent need">
                        <input type="range" min={1} max={5} step={1}
                          value={form.need_level ?? 3}
                          onChange={e => set('need_level', parseInt(e.target.value))}
                          className="w-full mt-2 accent-[#c026d3]" />
                        <div className="flex justify-between text-[10px] text-[#475569] mt-0.5">
                          <span>Cold</span><span>Lukewarm</span><span>🔥 Hot</span>
                        </div>
                      </Field>
                      <Field label="Timing" full tip="How soon might they need your product?">
                        <select className="alien-select" value={form.timing || ''} onChange={e => set('timing', e.target.value || undefined)}>
                          <option value="">Select…</option>
                          {['Immediate', '30 days', '90 days', 'Not sure'].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                    </Section>
                  </>
                )}

                {/* OUTREACH */}
                {activeSection === 'outreach' && (
                  <>
                    {/* Outreach Reference Table */}
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="px-4 py-2 text-[10px] uppercase tracking-widest"
                        style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                        📡 Outreach Status Guide
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                            {['Status', 'Meaning', 'Next Step'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[#64748b] text-[10px] tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['No response', 'Sent but no reply', 'Follow-up in 3–5 days'],
                            ['Interested', 'Responded positively', 'Schedule demo/call'],
                            ['Not interested', 'Declined', 'Archive, periodic re-engage'],
                            ['Converted', 'Closed the deal! 🎉', 'Onboard & upsell'],
                          ].map(([status, meaning, next]) => (
                            <tr key={status} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <td className="px-3 py-1.5" style={{ color: '#c026d3' }}>{status}</td>
                              <td className="px-3 py-1.5 text-[#94a3b8]">{meaning}</td>
                              <td className="px-3 py-1.5 text-[#64748b]">{next}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Section title="Outreach Tracking">
                      <Field label="Contacted?" full>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.contacted ?? false} onChange={e => set('contacted', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#c026d3]" />
                          <span className="text-sm text-[#94a3b8]">{form.contacted ? '✅ Yes, contacted' : 'Not yet contacted'}</span>
                        </label>
                      </Field>
                      <Field label="Channel" tip="How did you reach out?">
                        <select className="alien-select" value={form.channel || ''} onChange={e => set('channel', e.target.value || undefined)}>
                          <option value="">Select…</option>
                          {['Email', 'LinkedIn', 'Phone', 'Other'].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Response Status">
                        <select className="alien-select" value={form.response_status || ''} onChange={e => set('response_status', e.target.value || undefined)}>
                          <option value="">Select…</option>
                          {['No response', 'Interested', 'Not interested', 'Converted'].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </Field>
                      <Field label="Date Contacted">
                        <input type="datetime-local" className="alien-input"
                          value={form.date_contacted ? form.date_contacted.slice(0, 16) : ''}
                          onChange={e => set('date_contacted', e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
                      </Field>
                      <Field label="Follow-up Date">
                        <input type="date" className="alien-input"
                          value={form.follow_up_date || ''}
                          onChange={e => set('follow_up_date', e.target.value || undefined)} />
                      </Field>
                      <Field label="Notes" full>
                        <textarea className="alien-input resize-none" rows={4} placeholder="Any intel on this lead..."
                          value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
                      </Field>
                    </Section>
                  </>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,15,0.6)' }}
              >
                <button onClick={onClose} className="btn-ghost text-xs">
                  Cancel Mission
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-plasma text-xs">
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <UfoIcon size={16} animate={false} />
                      Beaming up...
                    </span>
                  ) : (
                    <>🛸 {lead?.id ? 'Update Specimen' : 'Abduct Lead'}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
