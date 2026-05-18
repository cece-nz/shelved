import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'

const schema = z.object({
  email: z.email('Enter a valid email'),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }: FormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setServerError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-3 p-6 text-stone-800">
        <BookOpen className="h-10 w-10" />
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-stone-500">
          Click the magic link to sign in to Shelved.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 p-6 text-stone-800">
      <div className="flex flex-col items-center gap-2">
        <BookOpen className="h-10 w-10" />
        <h1 className="text-3xl font-semibold">Shelved</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-xs flex flex-col gap-3"
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-red-600">{errors.email.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : 'Send magic link'}
        </button>

        {serverError && (
          <p className="text-xs text-red-600">{serverError}</p>
        )}
      </form>
    </div>
  )
}
