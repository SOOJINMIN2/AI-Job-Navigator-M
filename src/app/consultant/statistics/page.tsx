import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatisticsDashboardClient from './StatisticsDashboardClient'

export default async function ConsultantStatisticsPage() {
    const supabase = await createClient()

    // 1. Validate Consultant access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') redirect('/student/dashboard')

    // 2. Fetch full snapshot of requests for calculations
    const { data: requests, error } = await supabase
        .from('consulting_requests')
        .select('id, status, target_company, created_at, users ( full_name )')

    if (error) {
        return <div className="p-8 text-red-500">Failed to load statistics data.</div>
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 font-sans">

            <header className="h-20 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-8 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Consultant Hub
                    </h1>
                    <nav className="flex items-center gap-4 border-l border-gray-200 dark:border-zinc-800 pl-6">
                        <Link href="/consultant/workspace" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Workspace
                        </Link>
                        <Link href="/dashboard/prompts" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Prompts
                        </Link>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 pb-1">
                            Statistics
                        </span>
                    </nav>
                </div>

                <form action="/auth/signout" method="post">
                    <button className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        Sign out
                    </button>
                </form>
            </header>

            <main className="max-w-7xl mx-auto p-8">
                <StatisticsDashboardClient requests={requests as any || []} />
            </main>

        </div>
    )
}
