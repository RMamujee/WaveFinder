'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/auth-client'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const formData = new FormData(e.currentTarget)
    const res = await signIn.email({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })
    setPending(false)
    if (res.error) {
      setError(res.error.message ?? 'Unable to sign in.')
      return
    }
    router.push(searchParams.get('next') ?? '/dashboard')
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>Sign in</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Access your trial, billing, and synced WaveFinder data.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input name="email" type="email" required placeholder="Email" className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--border)' }} />
        <input name="password" type="password" required placeholder="Password" className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--border)' }} />
        {error && <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
        <button disabled={pending} className="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--ocean-600)' }}>
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-sm" style={{ color: 'var(--text-2)' }}>
        New here? <Link href="/sign-up" className="font-semibold hover:underline" style={{ color: 'var(--ocean-600)' }}>Create an account</Link>
      </p>
    </main>
  )
}
