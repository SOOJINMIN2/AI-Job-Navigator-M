import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UploadForm from './UploadForm'

export default async function StudentDashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch existing requests
    const { data: requests } = await supabase
        .from('consulting_requests')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-4xl mx-auto space-y-8">

                <header className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold dark:text-gray-100">Student Dashboard</h1>
                    <form action="/auth/signout" method="post">
                        <button className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Sign out
                        </button>
                    </form>
                </header>

                {/* Upload Form */}
                <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-6 dark:text-gray-200">New Consulting Request</h2>
                    <UploadForm />
                </section>

                {/* Previous Requests list */}
                <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-6 dark:text-gray-200">My Requests</h2>
                    <div className="space-y-4">
                        {requests?.length === 0 ? (
                            <div className="text-gray-500 dark:text-zinc-400 text-sm py-4">
                                No requests submitted yet.
                            </div>
                        ) : (
                            requests?.map(req => (
                                <div key={req.id} className="p-4 border border-gray-100 dark:border-zinc-800 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-medium dark:text-gray-100">{req.target_company}</p>
                                        <p className="text-xs text-gray-500 mt-1">Status: <span className="uppercase font-semibold tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 ml-1">{req.status}</span></p>
                                    </div>

                                    {req.status === 'completed' && (
                                        <Link
                                            href={`/student/result/${req.id}`}
                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-md transition-colors shadow-sm whitespace-nowrap"
                                        >
                                            View & Download PDF
                                        </Link>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>

            </div>
        </div>
    )
}
