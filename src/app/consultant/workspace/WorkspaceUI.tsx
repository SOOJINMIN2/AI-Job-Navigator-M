'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { saveFinalResult, createConsultantSession } from '@/lib/actions/consultant'

type SessionType = {
    id: string
    client_name: string | null
    target_company: string | null
    job_description_url_or_text: string | null
    cover_letter_text: string | null
    status: string
    created_at: string
    documents: { file_url: string; parsed_text: string }[]
}

type PromptType = {
    id: string
    title: string
    category: string
    system_prompt: string
}

export default function WorkspaceUI({
    initialSessions,
    prompts,
}: {
    initialSessions: SessionType[]
    prompts: PromptType[]
}) {
    const [sessions, setSessions] = useState<SessionType[]>(initialSessions)
    const [selectedSession, setSelectedSession] = useState<SessionType | null>(null)
    const [isCreatingNew, setIsCreatingNew] = useState(false)

    // 새 케이스 폼 상태
    const [clientName, setClientName] = useState('')
    const [company, setCompany] = useState('')
    const [jobDesc, setJobDesc] = useState('')
    const [coverLetter, setCoverLetter] = useState('')
    const [resumeFile, setResumeFile] = useState<File | null>(null)
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
    const [formError, setFormError] = useState('')

    // AI 상태
    const [selectedModel, setSelectedModel] = useState<string>('gemini')
    const [selectedPromptId, setSelectedPromptId] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)
    const [isExportingDocs, setIsExportingDocs] = useState(false)

    const { completion, setCompletion, complete, isLoading, error: aiError } = useCompletion({
        api: '/api/generate',
    })

    const handleNewCase = () => {
        setIsCreatingNew(true)
        setSelectedSession(null)
        setCompletion('')
        setSelectedPromptId('')
        setFormStatus('idle')
        setFormError('')
        setClientName('')
        setCompany('')
        setJobDesc('')
        setCoverLetter('')
        setResumeFile(null)
    }

    const handleSelectSession = (s: SessionType) => {
        setSelectedSession(s)
        setIsCreatingNew(false)
        setCompletion('')
        setSelectedPromptId('')
    }

    const handleCreateSession = async () => {
        if (!company.trim()) {
            setFormError('회사명은 필수 입력 항목입니다.')
            return
        }
        if (!resumeFile) {
            setFormError('이력서 PDF 파일을 선택해주세요.')
            return
        }
        setFormStatus('submitting')
        setFormError('')

        try {
            // 1. DB에 consulting_request 생성
            const fd = new FormData()
            fd.append('client_name', clientName)
            fd.append('company', company)
            fd.append('job_description', jobDesc)
            fd.append('cover_letter', coverLetter)

            const newSession = await createConsultantSession(fd)

            // 2. PDF 업로드 및 파싱
            const uploadFd = new FormData()
            uploadFd.append('file', resumeFile)
            uploadFd.append('request_id', newSession.id)
            uploadFd.append('document_type', 'resume')

            const uploadRes = await fetch('/api/upload-document', {
                method: 'POST',
                body: uploadFd,
            })

            if (!uploadRes.ok) {
                const errData = await uploadRes.json()
                throw new Error(errData.error || 'PDF 업로드 실패')
            }

            // 3. 최신 데이터로 새로고침 (document 정보 반영)
            window.location.reload()
        } catch (err: any) {
            setFormError(err.message || '케이스 생성에 실패했습니다.')
            setFormStatus('error')
        }
    }

    const handleGenerate = async () => {
        if (!selectedSession || !selectedPromptId) return

        const prompt = prompts.find((p) => p.id === selectedPromptId)
        if (!prompt) return

        const student_data = `고객명: ${selectedSession.client_name || '미입력'}
지원 회사: ${selectedSession.target_company || '미입력'}
지원 직무: ${selectedSession.job_description_url_or_text || '미입력'}
자기소개서:
${selectedSession.cover_letter_text || '첨부된 자기소개서 없음'}

이력서 텍스트 (PDF 추출):
${selectedSession.documents?.[0]?.parsed_text || '이력서 텍스트 없음'}`

        await complete('', {
            body: {
                system_prompt: prompt.system_prompt,
                student_data,
                model_provider: selectedModel,
            },
        })
    }

    const handleSave = async () => {
        if (!selectedSession || !completion) return
        setIsSaving(true)
        try {
            await saveFinalResult(selectedSession.id, completion)
            alert('결과가 저장되었습니다. 케이스가 완료 처리되었습니다.')
            window.location.reload()
        } catch {
            alert('저장에 실패했습니다.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleExportDocs = async () => {
        if (!selectedSession || !completion) return
        setIsExportingDocs(true)
        try {
            const res = await fetch('/api/export/docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    final_content: completion,
                    student_name: selectedSession.client_name || '고객',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Export 실패')
            alert('Google Docs로 내보내기 성공!')
            window.open(data.url, '_blank')
        } catch (err: any) {
            alert(`Export 실패: ${err.message}`)
        } finally {
            setIsExportingDocs(false)
        }
    }

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50 dark:bg-zinc-950">

            {/* 왼쪽 패널: 케이스 목록 */}
            <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-800">
                    <button
                        onClick={handleNewCase}
                        className={`w-full py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                            isCreatingNew
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        + 새 케이스
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {sessions.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400 mt-4">
                            케이스가 없습니다.<br />새 케이스를 생성해보세요.
                        </div>
                    )}
                    {sessions.map((s) => (
                        <div
                            key={s.id}
                            onClick={() => handleSelectSession(s)}
                            className={`p-3 border-b border-gray-100 dark:border-zinc-800 cursor-pointer transition-colors ${
                                selectedSession?.id === s.id && !isCreatingNew
                                    ? 'bg-blue-50 dark:bg-zinc-800 border-l-4 border-l-blue-500'
                                    : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                            }`}
                        >
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                {s.client_name || '(이름 없음)'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {s.target_company || '-'}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                    s.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                    {s.status === 'completed' ? '완료' : '진행중'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 메인 콘텐츠 */}
            {isCreatingNew ? (
                /* 새 케이스 생성 폼 */
                <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
                    <div className="max-w-2xl mx-auto p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">새 컨설팅 케이스</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">고객 정보를 입력하고 이력서를 업로드하세요.</p>
                        </div>

                        <div className="space-y-5">
                            {/* 고객 이름 */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    고객(학생) 이름 <span className="font-normal text-gray-400">(선택)</span>
                                </label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="홍길동"
                                />
                            </div>

                            {/* 회사명 */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    지원 회사명 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="삼성전자, 카카오, LG화학 등"
                                />
                            </div>

                            {/* 지원 직무 */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    지원 직무 <span className="font-normal text-gray-400">(선택)</span>
                                </label>
                                <input
                                    type="text"
                                    value={jobDesc}
                                    onChange={(e) => setJobDesc(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="소프트웨어 엔지니어, 마케팅 기획, 재무회계 등"
                                />
                            </div>

                            {/* 이력서 PDF */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    이력서 (PDF) <span className="text-red-500">*</span>
                                </label>
                                <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 cursor-pointer"
                                    />
                                    {resumeFile ? (
                                        <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                            ✓ {resumeFile.name} ({(resumeFile.size / 1024).toFixed(1)} KB)
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-xs text-gray-400">PDF 형식만 지원됩니다</p>
                                    )}
                                </div>
                            </div>

                            {/* 자기소개서 */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    자기소개서 <span className="font-normal text-gray-400">(선택)</span>
                                </label>
                                <textarea
                                    value={coverLetter}
                                    onChange={(e) => setCoverLetter(e.target.value)}
                                    rows={10}
                                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                    placeholder="고객의 자기소개서 내용을 여기에 붙여넣으세요..."
                                />
                            </div>

                            {/* 에러 메시지 */}
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                                    {formError}
                                </div>
                            )}

                            {/* 버튼 */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleCreateSession}
                                    disabled={formStatus === 'submitting'}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 shadow-sm"
                                >
                                    {formStatus === 'submitting' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                            </svg>
                                            PDF 처리 중...
                                        </span>
                                    ) : '케이스 생성'}
                                </button>
                                <button
                                    onClick={() => setIsCreatingNew(false)}
                                    disabled={formStatus === 'submitting'}
                                    className="px-6 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : !selectedSession ? (
                /* 빈 상태 */
                <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">케이스를 선택하거나 새로운 케이스를 생성하세요</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">왼쪽 목록에서 케이스를 클릭하거나 새 케이스 버튼을 누르세요</p>
                        </div>
                        <button
                            onClick={handleNewCase}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                            + 새 케이스 생성
                        </button>
                    </div>
                </div>
            ) : (
                /* 기존 케이스 뷰 */
                <div className="flex-1 flex h-full min-w-0 overflow-hidden">

                    {/* 가운데: 케이스 정보 */}
                    <div className="flex-1 border-r border-gray-200 dark:border-zinc-800 p-6 overflow-y-auto bg-white dark:bg-zinc-900">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {selectedSession.client_name || '(이름 없음)'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {selectedSession.target_company || '회사 미입력'}
                                {selectedSession.job_description_url_or_text && (
                                    <span className="ml-2 text-gray-400">· {selectedSession.job_description_url_or_text}</span>
                                )}
                            </p>
                        </div>

                        <div className="space-y-6">
                            {selectedSession.cover_letter_text && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">자기소개서</h4>
                                    <div className="bg-gray-50 dark:bg-zinc-950 p-4 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap border border-gray-200 dark:border-zinc-800 max-h-64 overflow-y-auto leading-relaxed">
                                        {selectedSession.cover_letter_text}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                    이력서 (PDF)
                                    {selectedSession.documents?.[0]?.file_url && (
                                        <a
                                            href={selectedSession.documents[0].file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 hover:underline text-xs normal-case font-normal"
                                        >
                                            새 탭에서 열기 →
                                        </a>
                                    )}
                                </h4>
                                {selectedSession.documents?.[0]?.file_url ? (
                                    <div className="h-96 w-full border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-gray-100 dark:bg-black">
                                        <iframe
                                            src={selectedSession.documents[0].file_url}
                                            className="w-full h-full"
                                            title="이력서"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">첨부된 이력서가 없습니다.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: AI 생성 패널 */}
                    <div className="flex-1 p-6 flex flex-col bg-gray-50 dark:bg-zinc-950 h-full overflow-y-auto min-w-0">
                        <h3 className="text-xl font-bold mb-5 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent w-max">
                            AI 컨설턴트
                        </h3>

                        {/* AI 모델 선택 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">AI 모델 선택</label>
                            <div className="flex gap-1.5">
                                {[
                                    { id: 'gemini', label: 'Gemini 1.5 Pro', badge: '~₩16/건' },
                                    { id: 'claude-haiku', label: 'Claude Haiku', badge: '~₩12/건' },
                                    { id: 'claude-sonnet', label: 'Claude Sonnet', badge: '~₩47/건' },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedModel(m.id)}
                                        className={`flex-1 py-2 px-1 rounded-md text-xs font-semibold border transition-colors ${
                                            selectedModel === m.id
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-600 hover:border-blue-400'
                                        }`}
                                    >
                                        <div className="leading-tight">{m.label}</div>
                                        <div className={`text-[9px] mt-0.5 ${selectedModel === m.id ? 'text-blue-100' : 'text-gray-400'}`}>{m.badge}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 프롬프트 선택 + 생성 */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">프롬프트 선택</label>
                            <div className="flex gap-2">
                                <select
                                    value={selectedPromptId}
                                    onChange={(e) => setSelectedPromptId(e.target.value)}
                                    className="flex-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="" disabled>프롬프트를 선택하세요...</option>
                                    {prompts.map((p) => (
                                        <option key={p.id} value={p.id}>[{p.category}] {p.title}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading || !selectedPromptId}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                    {isLoading ? '생성 중...' : '생성'}
                                </button>
                            </div>
                        </div>

                        {aiError && (
                            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                                오류: {aiError.message}
                            </div>
                        )}

                        {/* 결과 출력 + 저장 */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                                <span>생성 결과 (수정 가능)</span>
                                {isLoading && <span className="text-blue-500 text-xs animate-pulse normal-case font-normal">스트리밍 중...</span>}
                            </label>
                            <textarea
                                value={completion}
                                onChange={(e) => setCompletion(e.target.value)}
                                className="flex-1 w-full p-4 rounded-lg border border-gray-300 dark:border-zinc-700 shadow-inner bg-white dark:bg-zinc-900 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-200 mb-3 min-h-52"
                                placeholder="AI가 생성한 컨설팅 결과가 여기에 표시됩니다. 저장 전에 내용을 수정할 수 있습니다."
                            />
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !completion}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors mb-2 shadow-sm"
                            >
                                {isSaving ? '저장 중...' : '✓ 결과 저장 (케이스 완료)'}
                            </button>
                            <button
                                onClick={handleExportDocs}
                                disabled={isExportingDocs || !completion}
                                className="w-full bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-700 border border-blue-200 dark:border-blue-800 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                            >
                                {isExportingDocs ? '내보내는 중...' : 'Google Docs로 내보내기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
