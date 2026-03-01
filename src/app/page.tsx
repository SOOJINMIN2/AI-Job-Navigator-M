import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-zinc-950 dark:to-zinc-900">
      <main className="max-w-3xl w-full text-center space-y-8 bg-white/70 dark:bg-zinc-900/70 p-12 rounded-3xl backdrop-blur-md shadow-xl border border-white/20 dark:border-zinc-800/50">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-7xl mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            AI Job Navigator
          </span>
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Elevate your career prospects. Upload your resume and get expert-level, AI-driven consulting tailored to your dream company and role.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-6">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all hover:scale-105"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-full bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all hover:scale-105"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Sign in <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
