'use client'

import { useEffect, useState, useId } from 'react'
import {
  getGear, saveGear,
  BOARD_TYPES, WETSUIT_OPTIONS,
  type GearItem, type GearBoard, type GearWetsuit, type BoardType, type WetsuitThickness,
} from '@/lib/gear'
import { Icon, type WFIconName } from '@/components/ui/Icon'

// ── helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--sand-50)',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    color: 'var(--text)',
    outline: 'none',
    ...extra,
  }
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-3)',
    marginBottom: '5px',
  }
}

// ── Board form ────────────────────────────────────────────────────────────────

const EMPTY_BOARD = { name: '', boardType: 'Shortboard' as BoardType, lengthFt: '', volume: '', notes: '' }
const EMPTY_WETSUIT = { name: '', thickness: '3/2mm' as WetsuitThickness, notes: '' }

interface BoardFormProps { initial?: Partial<typeof EMPTY_BOARD>; onSave: (v: typeof EMPTY_BOARD) => void; onCancel: () => void }

function BoardForm({ initial, onSave, onCancel }: BoardFormProps) {
  const [v, setV] = useState({ ...EMPTY_BOARD, ...initial })
  const f = (k: keyof typeof EMPTY_BOARD, val: string) => setV(p => ({ ...p, [k]: val }))
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label style={labelStyle()}>Board name / nickname</label>
          <input value={v.name} onChange={e => f('name', e.target.value)} placeholder='e.g. "The Rocket"' style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Type</label>
          <select value={v.boardType} onChange={e => f('boardType', e.target.value)} style={inputStyle({ appearance: 'auto' })}>
            {BOARD_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>Length</label>
          <input value={v.lengthFt} onChange={e => f('lengthFt', e.target.value)} placeholder="e.g. 6'2&quot;" style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Volume</label>
          <input value={v.volume} onChange={e => f('volume', e.target.value)} placeholder="e.g. 32L" style={inputStyle()} />
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Notes</label>
        <input value={v.notes} onChange={e => f('notes', e.target.value)} placeholder="e.g. great in 3–6ft, quad fins" style={inputStyle()} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(v)} disabled={!v.name.trim()} className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--ocean-600)' }}>
          Save board
        </button>
        <button onClick={onCancel} className="rounded-xl px-5 py-2 text-sm font-semibold" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

interface WetsuitFormProps { initial?: Partial<typeof EMPTY_WETSUIT>; onSave: (v: typeof EMPTY_WETSUIT) => void; onCancel: () => void }

function WetsuitForm({ initial, onSave, onCancel }: WetsuitFormProps) {
  const [v, setV] = useState({ ...EMPTY_WETSUIT, ...initial })
  const f = (k: keyof typeof EMPTY_WETSUIT, val: string) => setV(p => ({ ...p, [k]: val }))
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label style={labelStyle()}>Wetsuit name / brand</label>
          <input value={v.name} onChange={e => f('name', e.target.value)} placeholder='e.g. "Rip Curl E-Bomb 3/2"' style={inputStyle()} />
        </div>
        <div>
          <label style={labelStyle()}>Thickness</label>
          <select value={v.thickness} onChange={e => f('thickness', e.target.value)} style={inputStyle({ appearance: 'auto' })}>
            {WETSUIT_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Notes</label>
        <input value={v.notes} onChange={e => f('notes', e.target.value)} placeholder="e.g. back zip, good to 55°F" style={inputStyle()} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(v)} disabled={!v.name.trim()} className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--ocean-600)' }}>
          Save wetsuit
        </button>
        <button onClick={onCancel} className="rounded-xl px-5 py-2 text-sm font-semibold" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps { item: GearItem; onEdit: () => void; onDelete: () => void }

function GearCard({ item, onEdit, onDelete }: CardProps) {
  const isBoard = item.kind === 'board'
  const board = item as GearBoard
  const wetsuit = item as GearWetsuit
  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon name={isBoard ? 'surfer' : 'board'} size={16} style={{ color: 'var(--text-3)' }} />
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill>{isBoard ? board.boardType : wetsuit.thickness}</Pill>
            {isBoard && board.lengthFt && <Pill>{board.lengthFt}</Pill>}
            {isBoard && board.volume && <Pill>{board.volume}</Pill>}
            {item.notes && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{item.notes}</span>}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onEdit} className="rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-80" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            Edit
          </button>
          <button onClick={onDelete} className="rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-80" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--sand-100)', color: 'var(--text-2)' }}>
      {children}
    </span>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

type AddState = 'board' | 'wetsuit' | null

export default function GearPage() {
  const [gear, setGear] = useState<GearItem[]>([])
  const [adding, setAdding] = useState<AddState>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { setGear(getGear()) }, [])

  const persist = (items: GearItem[]) => { setGear(items); saveGear(items) }

  const boards = gear.filter((g): g is GearBoard => g.kind === 'board')
  const wetsuits = gear.filter((g): g is GearWetsuit => g.kind === 'wetsuit')

  const addBoard = (v: typeof EMPTY_BOARD) => {
    persist([...gear, { ...v, id: uid(), kind: 'board', createdAt: new Date().toISOString() }])
    setAdding(null)
  }

  const addWetsuit = (v: typeof EMPTY_WETSUIT) => {
    persist([...gear, { ...v, id: uid(), kind: 'wetsuit', createdAt: new Date().toISOString() }])
    setAdding(null)
  }

  const updateItem = (id: string, updates: Partial<GearItem>) => {
    persist(gear.map(g => g.id === id ? ({ ...g, ...updates } as GearItem) : g))
    setEditingId(null)
  }

  const deleteItem = (id: string) => persist(gear.filter(g => g.id !== id))

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>My Gear</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>Gear Locker</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            Save your boards and wetsuits to quickly log what you used each session.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8 flex flex-col gap-10">

        {/* Boards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              <Icon name="surfer" size={16} className="inline mr-1" /> Boards <span className="font-normal text-sm ml-1" style={{ color: 'var(--text-3)' }}>({boards.length})</span>
            </h2>
            {adding !== 'board' && (
              <button onClick={() => { setAdding('board'); setEditingId(null) }} className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white" style={{ background: 'var(--ocean-600)' }}>
                + Add board
              </button>
            )}
          </div>

          {adding === 'board' && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid var(--ocean-300)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>New board</p>
              <BoardForm onSave={addBoard} onCancel={() => setAdding(null)} />
            </div>
          )}

          {boards.length === 0 && adding !== 'board' ? (
            <EmptyState icon="surfer" label="No boards yet" sub="Add your quiver to track what you ride each session." onAdd={() => setAdding('board')} addLabel="Add first board" />
          ) : (
            <div className="flex flex-col gap-3">
              {boards.map(b => editingId === b.id ? (
                <div key={b.id} className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid var(--ocean-300)' }}>
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Edit board</p>
                  <BoardForm
                    initial={{ name: b.name, boardType: b.boardType, lengthFt: b.lengthFt, volume: b.volume, notes: b.notes }}
                    onSave={v => updateItem(b.id, v)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <GearCard key={b.id} item={b} onEdit={() => { setEditingId(b.id); setAdding(null) }} onDelete={() => deleteItem(b.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Wetsuits */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              <Icon name="board" size={16} className="inline mr-1" /> Wetsuits <span className="font-normal text-sm ml-1" style={{ color: 'var(--text-3)' }}>({wetsuits.length})</span>
            </h2>
            {adding !== 'wetsuit' && (
              <button onClick={() => { setAdding('wetsuit'); setEditingId(null) }} className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white" style={{ background: 'var(--ocean-600)' }}>
                + Add wetsuit
              </button>
            )}
          </div>

          {adding === 'wetsuit' && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid var(--ocean-300)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>New wetsuit</p>
              <WetsuitForm onSave={addWetsuit} onCancel={() => setAdding(null)} />
            </div>
          )}

          {wetsuits.length === 0 && adding !== 'wetsuit' ? (
            <EmptyState icon="board" label="No wetsuits yet" sub="Add your suits to log water temp comfort each session." onAdd={() => setAdding('wetsuit')} addLabel="Add first wetsuit" />
          ) : (
            <div className="flex flex-col gap-3">
              {wetsuits.map(w => editingId === w.id ? (
                <div key={w.id} className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid var(--ocean-300)' }}>
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Edit wetsuit</p>
                  <WetsuitForm
                    initial={{ name: w.name, thickness: w.thickness, notes: w.notes }}
                    onSave={v => updateItem(w.id, v)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <GearCard key={w.id} item={w} onEdit={() => { setEditingId(w.id); setAdding(null) }} onDelete={() => deleteItem(w.id)} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

function EmptyState({ icon, label, sub, onAdd, addLabel }: { icon: WFIconName; label: string; sub: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="rounded-2xl py-12 text-center" style={{ border: '2px dashed var(--border)', background: 'white' }}>
      <div className="flex justify-center mb-3"><Icon name={icon} size={28} style={{ color: 'var(--text-3)' }} /></div>
      <p className="font-medium mb-1 text-sm" style={{ color: 'var(--text)' }}>{label}</p>
      <p className="text-sm mb-5" style={{ color: 'var(--text-3)' }}>{sub}</p>
      <button onClick={onAdd} className="inline-block rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: 'var(--ocean-600)' }}>
        {addLabel}
      </button>
    </div>
  )
}
