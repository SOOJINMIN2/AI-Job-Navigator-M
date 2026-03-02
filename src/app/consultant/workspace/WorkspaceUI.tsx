'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { saveFinalResult } from '@/lib/actions/consultant'

type RequestType = {
    id: string
    student_id: string
    target_company: string
    job_description_url_or_text: string
    status: string
    created_at: string
    documents: { file_url: string, parsed_text: string }[]
}

type PromptType = {
    id: string
    title: string
    category: string
    system_prompt: string
}

export default function WorkspaceUI({ requests, prompts }: { requests: RequestType[], prompts: PromptType[] }) {
    const [selectedRequest, setSelectedRequest] = useState<RequestType | null>(null)
    const [selectedPromptId, setSelectedPromptId] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)
    const [isExportingDocs, setIsExportingDocs] = useState(false)

    // Configure Vercel AI SDK useCompletion targeting the /api/generate endpoint
    // We manually control the completion string in the textarea using the setCompletion/handleInputChange provided
    const { completion, setCompletion, complete, isLoading, error } = useCompletion({
        api: '/api/generate',
    })

    const handleGenerate = async () => {
        if (!selectedRequest || !selectedPromptId) return

        const prompt = prompts.find(p => p.id === selectedPromptId)
        if (!prompt) return

        // student_data combines everything the consultant needs the AI to look at
        const student_data = `
Target Company: ${selectedRequest.target_company}
Job Requirements: ${selectedRequest.job_description_url_or_text || 'No job description provided.'}
Resume Document Text: ${selectedRequest.documents?.[0]?.parsed_text || 'No text extracted.'}
`

        // Start streaming from Gemini
        await complete('', {
            body: {
                system_prompt: prompt.system_prompt,
                student_data: student_data
            }
        })
    }

    const handleSave = async () => {
        if (!selectedRequest || !completion) return
        setIsSaving(true)
        try {
            await saveFinalResult(selectedRequest.id, completion)
            alert('Result saved successfully. Request marked as completed.')
            // In a production app, you might remove the item from the list here,
            // but revalidatePath on the server action will refresh the data if we reload or navigate.
            window.location.reload()
        } catch (e) {
            alert('Failed to save result.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleExportDocs = async () => {
        if (!selectedRequest || !completion) return
        setIsExportingDocs(true)
        try {
            const response = await fetch('/api/export/docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    final_content: completion,
                    student_name: 'Student'
                })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to export to docs')

            alert('Successfully exported to Google Docs!')
            window.open(data.url, '_blank') // Open document in new tab
        } catch (err: any) {
            alert(`Export Failed: ${err.message}`)
        } finally {
            setIsExportingDocs(false)
        }
    }

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50 dark:bg-zinc-950">

            {/* LEFT PANEL: Data Viewer */}
            <div className="w-1/3 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pending Requests</h2>
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded-full">{requests.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {requests.map(req => (
                        <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className={`p-4 border-b border-gray-100 dark:border-zinc-800 cursor-pointer transition-colors ${selectedRequest?.id === req.id ? 'bg-blue-50 dark:bg-zinc-800 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
                        >
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                {req.target_company}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">{req.target_company}</div>
                            <div className="text-xs text-gray-400 mt-2">
                                {new Date(req.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && (
                        <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No pending requests.
                        </div>
                    )}
                </div>
            </div>

            {/* MIDDLE/RIGHT PANEL: Consultant Workspace */}
            <div className="flex-1 flex flex-col min-w-0">
                {!selectedRequest ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        Select a pending request from the left panel to begin.
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col lg:flex-row h-full">

                        {/* Student Details Viewer (Center) */}
                        <div className="flex-1 border-r border-gray-200 dark:border-zinc-800 p-6 overflow-y-auto bg-white dark:bg-zinc-900">
                            <h3 className="text-xl font-bold dark:text-gray-100 mb-6">Student Context</h3>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Job Description</h4>
                                    <div className="bg-gray-50 dark:bg-zinc-950 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap border border-gray-100 dark:border-zinc-800">
                                        {selectedRequest.job_description_url_or_text || 'None provided.'}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                        User Document
                                        {selectedRequest.documents?.[0]?.file_url && (
                                            <a href={selectedRequest.documents[0].file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs normal-case">
                                                Open PDF in new tab
                                            </a>
                                        )}
                                    </h4>
                                    {selectedRequest.documents?.[0]?.file_url ? (
                                        <div className="h-[400px] w-full border border-gray-200 dark:border-zinc-800 rounded-md overflow-hidden bg-gray-100 dark:bg-black">
                                            <iframe
                                                src={selectedRequest.documents[0].file_url}
                                                className="w-full h-full"
                                                title="Student Document"
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No document attached.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* AI Generator Panel (Right) */}
                        <div className="flex-1 p-6 flex flex-col bg-gray-50 dark:bg-zinc-950 h-full">
                            <h3 className="text-xl font-bold dark:text-gray-100 mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent w-max">AI Consultant</h3>

                            <div className="mb-4">
                                <label htmlFor="prompt-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select AI Prompt
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        id="prompt-select"
                                        value={selectedPromptId}
                                        onChange={(e) => setSelectedPromptId(e.target.value)}
                                        className="flex-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="" disabled>Choose a predefined prompt...</option>
                                        {prompts.map(p => (
                                            <option key={p.id} value={p.id}>[{p.category}] {p.title}</option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isLoading || !selectedPromptId}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                                    Failed to generate response: {error.message}
                                </div>
                            )}

                            <div className="flex-1 flex flex-col mt-2 min-h-0">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex justify-between items-center">
                                    <span>Generated Response (Editable)</span>
                                    {isLoading && <span className="text-blue-500 text-xs animate-pulse">Streaming...</span>}
                                </label>
                                <textarea
                                    value={completion}
                                    onChange={(e) => setCompletion(e.target.value)}
                                    className="flex-1 w-full p-4 rounded-md border border-gray-300 dark:border-zinc-700 shadow-inner bg-white dark:bg-zinc-900 text-sm font-sans resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200 mb-4"
                                    placeholder="AI generated content will stream here. You can manually edit it before saving."
                                />
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !completion}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-md text-sm font-bold shadow-md disabled:opacity-50 transition-colors mb-2"
                                >
                                    {isSaving ? 'Saving Result...' : 'Save Final Result'}
                                </button>
                                <button
                                    onClick={handleExportDocs}
                                    disabled={isExportingDocs || !completion}
                                    className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 py-3 rounded-md text-sm font-bold shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isExportingDocs ? 'Creating Document...' : 'Export to Google Docs'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
