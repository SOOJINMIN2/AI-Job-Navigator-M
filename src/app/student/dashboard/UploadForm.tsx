'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function UploadForm() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [selectedFileName, setSelectedFileName] = useState('')

    // We instantiate a minimal client here to create the parent request row
    // Using the new environment variables
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrorMsg('')

        try {
            const form = e.currentTarget
            const targetCompany = (form.elements.namedItem('target_company') as HTMLInputElement).value
            const jobDescription = (form.elements.namedItem('job_description') as HTMLTextAreaElement).value
            const fileInput = form.elements.namedItem('document') as HTMLInputElement
            const file = fileInput.files?.[0]

            if (!file) throw new Error("PDF 파일을 첨부해주세요.")

            // 1. Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("로그인이 필요합니다.")

            // 2. Create the Request Row in Supabase DB first (to get request_id)
            const { data: requestData, error: requestError } = await supabase
                .from('consulting_requests')
                .insert({
                    student_id: user.id,
                    target_company: targetCompany,
                    job_description_url_or_text: jobDescription,
                    status: 'pending'
                })
                .select('id')
                .single()

            if (requestError || !requestData) {
                throw new Error(`Failed to initialize request: ${requestError?.message || 'Unknown error'}`)
            }

            // 3. Post to the custom API Route to handle PDF Parsing & Storage
            const formData = new FormData()
            formData.append('file', file)
            formData.append('request_id', requestData.id)
            formData.append('document_type', 'resume')

            const response = await fetch('/api/upload-document', {
                method: 'POST',
                body: formData,
            })

            const responseData = await response.json()

            if (!response.ok) {
                // Since we explicitly made the consulting request, if the parser fails
                // we should arguably roll back / delete the request here or leave it empty.
                // For now, we will notify the user.
                await supabase.from('consulting_requests').delete().eq('id', requestData.id)
                throw new Error(responseData.error || 'Failed to process document.')
            }

            // Success! Refresh the page data.
            form.reset()
            setSelectedFileName('')
            router.refresh()

        } catch (err: any) {
            console.error(err)
            setErrorMsg(err.message || 'An unexpected error occurred.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                    {errorMsg}
                </div>
            )}

            <div>
                <label htmlFor="target_company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    지원 회사 및 직무
                </label>
                <input
                    id="target_company"
                    name="target_company"
                    type="text"
                    required
                    disabled={isSubmitting}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="예: 삼성전자 - 소프트웨어 엔지니어"
                />
            </div>

            <div>
                <label htmlFor="job_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    채용 공고 내용
                </label>
                <textarea
                    id="job_description"
                    name="job_description"
                    rows={4}
                    required
                    disabled={isSubmitting}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    placeholder="채용 공고 내용이나 요구사항을 붙여넣어 주세요..."
                />
            </div>

            <div>
                <label htmlFor="document" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    이력서 / 포트폴리오 업로드 (PDF)
                </label>
                <div className="mt-1 flex justify-center rounded-lg border border-dashed border-gray-900/25 dark:border-zinc-700 px-6 py-10 w-full bg-gray-50 dark:bg-zinc-800/50">
                    <div className="text-center">
                        <div className="mt-4 flex flex-col items-center justify-center text-sm leading-6 text-gray-600 dark:text-gray-400">
                            <label
                                htmlFor="document"
                                className={`relative cursor-pointer rounded-md bg-transparent font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500 ${isSubmitting && 'opacity-50 cursor-not-allowed'}`}
                            >
                                <span>파일 선택</span>
                                <input
                                    id="document"
                                    name="document"
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf"
                                    required
                                    disabled={isSubmitting}
                                    onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || '')}
                                />
                            </label>
                            <p className="mt-1">또는 드래그 앤 드롭</p>
                        </div>
                        {selectedFileName ? (
                            <p className="text-xs leading-5 text-blue-600 dark:text-blue-400 mt-2 font-medium">✓ {selectedFileName}</p>
                        ) : (
                            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400 mt-2">PDF 최대 5MB</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            문서 처리 중...
                        </>
                    ) : '컨설팅 요청 제출'}
                </button>
            </div>
        </form>
    )
}
