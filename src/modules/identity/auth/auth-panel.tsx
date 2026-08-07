import type { ReactNode } from 'react'

export function AuthPanel({
  title,
  description,
  error,
  message,
  children,
  footer,
}: {
  title: string
  description: string
  error?: string
  message?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/20">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Atlas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="mb-6 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
          >
            {message}
          </div>
        ) : null}

        {children}

        {footer ? (
          <div className="mt-7 border-t border-zinc-800 pt-6 text-sm text-zinc-400">
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export const inputClassName =
  'mt-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-700'

export const primaryButtonClassName =
  'mt-2 h-11 w-full rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60'

export const linkClassName =
  'font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300'
