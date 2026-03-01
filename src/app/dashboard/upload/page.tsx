import { createConsultingRequest } from '@/lib/actions/upload'

export default function UploadPage() {
    return (
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-2xl mx-auto space-y-8">
                <header className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold dark:text-gray-100">New Consulting Request</h1>
                    <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        Back to Dashboard
                    </a>
                </header>

                <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <form action={createConsultingRequest} className="space-y-6">
                        <div>
                            <label htmlFor="target_company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Target Company & Role
                            </label>
                            <input
                                id="target_company"
                                name="target_company"
                                type="text"
                                required
                                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. Google - Software Engineer"
                            />
                        </div>

                        <div>
                            <label htmlFor="document" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Upload Resume / Cover Letter (PDF only)
                            </label>
                            <input
                                id="document"
                                name="document"
                                type="file"
                                accept=".pdf,application/pdf"
                                required
                                className="mt-1 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                            />
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Max file size: 5MB
                            </p>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                            >
                                Submit Request
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}
