import { createClient } from '@/lib/supabase/server'
import { createPrompt } from '@/lib/actions/prompts'
import { redirect } from 'next/navigation'

export default async function PromptsPage() {
    const supabase = await createClient()

    // 1. Get User Session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // 2. Fetch User Role
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'consultant') {
        redirect('/dashboard') // Redirect students away
    }

    // 3. Fetch Prompts
    const { data: prompts } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold dark:text-gray-100">Prompt Library</h1>
                    <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        Back to Dashboard
                    </a>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    <section className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm h-fit">
                        <h2 className="text-xl font-semibold mb-6 dark:text-gray-200">Add New Prompt</h2>
                        <form action={createPrompt} className="space-y-4">
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Category
                                </label>
                                <select
                                    id="category"
                                    name="category"
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="resume_review">Resume Review</option>
                                    <option value="cover_letter">Cover Letter Generation</option>
                                    <option value="interview_prep">Interview Prep</option>
                                    <option value="career_planning">Career Planning</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Title Name
                                </label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="e.g. Senior SWE Resume Reviewer"
                                />
                            </div>

                            <div>
                                <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    System Prompt
                                </label>
                                <textarea
                                    id="system_prompt"
                                    name="system_prompt"
                                    rows={6}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="You are an expert tech recruiter..."
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                                >
                                    Save Prompt
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="lg:col-span-2 space-y-4">
                        {prompts?.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-12 text-center text-gray-500 dark:text-zinc-400 shadow-sm">
                                You haven't created any prompts yet.
                            </div>
                        ) : (
                            prompts?.map((prompt) => (
                                <div key={prompt.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/30 mb-2">
                                                {prompt.category.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <h3 className="text-lg font-semibold dark:text-gray-200">{prompt.title}</h3>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-zinc-950 p-4 rounded-md border border-gray-100 dark:border-zinc-800">
                                        {prompt.system_prompt}
                                    </p>
                                </div>
                            ))
                        )}
                    </section>

                </div>
            </div>
        </div>
    )
}
