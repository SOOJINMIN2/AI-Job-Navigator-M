'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { useRouter } from 'next/navigation'
import { saveFinalResult } from '@/lib/actions/consultant'

type WorkspaceProps = {
    requestId: string
    targetCompany: string
    documentId: string
    prompts: { id: string, title: string, category: string }[]
}

export default function WorkspaceClient({
    requestId,
    targetCompany,
    documentId,
    prompts
}: WorkspaceProps) {
    const [selectedPrompt, setSelectedPrompt] = useState(prompts[0]?.id || '')
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    // The hook that handles calling our /api/chat route and streaming the response
    const { completion, complete, isLoading, error } = useCompletion({
        api: '/api/chat',
        body: {
            promptId: selectedPrompt,
            documentId: documentId,
            requestDetails: targetCompany
        }
    })

    const handleGenerate = async () => {
        if (!selectedPrompt) return
        // Trigger the actual API call. The empty string is required by the SDK type
        // but we have full control over the prompt body in the useCompletion hook
        await complete('generate_report')
    }

    const handleSave = async () => {
        if (!completion) return
        try {
            setIsSaving(true)
            await saveFinalResult(requestId, completion)
            router.push('/dashboard')
        } catch (err: any) {
            alert(`Failed to save result: ${err.message}`)
            setIsSaving(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Controls & Configuration */}
            <section className="lg:col-span-1 space-y-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm h-fit">
                <div>
                    <h2 className="text-xl font-semibold mb-2 dark:text-gray-200">Session Setup</h2>
                    <p className="text-sm text-gray-500 mb-6">Select a prompt to analyze this request.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Target Company & Role
                            </label>
                            <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-sm text-gray-900 dark:text-gray-100">
                                {targetCompany}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="prompt-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                AI Prompt Template
                            </label>
                            <select
                                id="prompt-select"
                                value={selectedPrompt}
                                onChange={(e) => setSelectedPrompt(e.target.value)}
                                className="block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="" disabled>Select a prompt...</option>
                                {prompts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        [{p.category.replace('_', ' ')}] {p.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !selectedPrompt}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                    {isLoading ? 'Generating AI Response...' : '✨ Generate Evaluation'}
                </button>

                {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                        Error: {error.message}
                    </div>
                )}
            </section>

            {/* Output / Document Area */}
            <section className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm min-h-[600px] flex flex-col">
                    <div className="border-b border-gray-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50 rounded-t-xl">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Analysis Result</h3>
                        {completion && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Saving...
                                    </>
                                ) : 'Save Content & Complete'}
                            </button>
                        )}
                    </div>

                    <div className="p-6 flex-1 overflow-auto bg-gray-50/20 dark:bg-neutral-900/20">
                        {!completion && !isLoading ? (
                            <div className="h-full flex items-center justify-center text-gray-400 dark:text-zinc-500 text-sm italic">
                                Run the prompt to generate AI review...
                            </div>
                        ) : (
                            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-blue">
                                {/* Basic whitespace formatting for the streamed markdown */}
                                <div className="whitespace-pre-wrap font-sans leading-relaxed text-gray-800 dark:text-gray-200">
                                    {completion}
                                </div>
                                {isLoading && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse rounded-sm"></span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
