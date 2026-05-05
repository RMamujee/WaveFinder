'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth-client'

export default function SignUpPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const res = await signUp.email({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })
    setPending(false)
    if (res.error) {
      setError(res.error.message ?? 'Unable to create account.')
      return
    }
    router.push('/pricing')
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>Create account</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Start your 7-day Pro trial after account creation.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input name="name" required placeholder="Name" className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--border)' }} />
        <input name="email" type="email" required placeholder="Email" className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--border)' }} />
        <input name="password" type="password" required minLength={8} placeholder="Password" className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--border)' }} />
        {error && <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
        <button disabled={pending} className="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--ocean-600)' }}>
          {pending ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-sm" style={{ color: 'var(--text-2)' }}>
        Already have an account? <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: 'var(--ocean-600)' }}>Sign in</Link>
      </p>
    </main>
  )
}
