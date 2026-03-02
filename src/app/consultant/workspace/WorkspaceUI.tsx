'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCompletion } from '@ai-sdk/react'
import { saveFinalResult, createConsultantSession, deleteSession } from '@/lib/actions/consultant'

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

// 내부 고정 프롬프트 (사용자에게 노출하지 않음)
const SYSTEM_PROMPT = `당신은 전문 취업 컨설턴트입니다. 아래 고객 정보를 바탕으로 종합 컨설팅 보고서를 작성해주세요.

## 1. 이력서 분석 (강점 / 보완점)
## 2. 자기소개서 분석 (완성도 / 개선 포인트)
## 3. 지원 직무 적합도 평가
## 4. 합격 가능성을 높이는 핵심 액션 아이템 (Top 5)
## 5. 컨설턴트 최종 의견`

export default function WorkspaceUI({
    initialSessions,
}: {
    initialSessions: SessionType[]
}) {
    const [sessions, setSessions] = useState<SessionType[]>(initialSessions)
    const [selectedSession, setSelectedSession] = useState<SessionType | null>(null)
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setSessions(initialSessions)

        // 새로고침 시 선택된 케이스(문서 등) 업데이트
        setSelectedSession(prev => {
            if (!prev) return null
            const updated = initialSessions.find(s => s.id === prev.id)
            return updated || prev
        })
    }, [initialSessions])

    // 새 케이스 폼 상태
    const [clientName, setClientName] = useState('')
    const [company, setCompany] = useState('')
    const [jobDesc, setJobDesc] = useState('')
    const [pdfFiles, setPdfFiles] = useState<File[]>([])
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
    const [formError, setFormError] = useState('')

    // AI 상태
    const [selectedModel, setSelectedModel] = useState<string>('gemini')
    const [isSaving, setIsSaving] = useState(false)
    const [isExportingDocs, setIsExportingDocs] = useState(false)
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

    const { completion, setCompletion, complete, isLoading, error: aiError } = useCompletion({
        api: '/api/generate',
    })

    const handleNewCase = () => {
        setIsCreatingNew(true)
        setSelectedSession(null)
        setCompletion('')
        setFormStatus('idle')
        setFormError('')
        setClientName('')
        setCompany('')
        setJobDesc('')
        setPdfFiles([])
    }

    const handleSelectSession = (s: SessionType) => {
        setSelectedSession(s)
        setIsCreatingNew(false)
        setCompletion('')
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []).slice(0, 2)
        setPdfFiles(selected)
    }

    const handleCreateSession = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault()

        if (!company.trim()) {
            setFormError('회사명은 필수 입력 항목입니다.')
            return
        }
        if (pdfFiles.length === 0) {
            setFormError('이력서 PDF 파일을 1개 이상 선택해주세요.')
            return
        }
        setFormStatus('submitting')
        setFormError('')

        try {
            console.log("Submitting case creation...");
            const fd = new FormData()
            fd.append('client_name', clientName)
            fd.append('company', company)
            fd.append('job_description', jobDesc)

            console.log("Calling createConsultantSession API action...");
            const newSession = await createConsultantSession(fd)
            console.log("Session created:", newSession);

            const docTypes = ['resume', 'cover_letter']
            const uploadedDocs = []

            for (let i = 0; i < pdfFiles.length; i++) {
                const uploadFd = new FormData()
                uploadFd.append('file', pdfFiles[i])
                uploadFd.append('request_id', newSession.id)
                uploadFd.append('document_type', docTypes[i])

                console.log(`Uploading document ${i + 1}/${pdfFiles.length}...`);
                const uploadRes = await fetch('/api/upload-document', {
                    method: 'POST',
                    body: uploadFd,
                })

                const responseData = await uploadRes.json()
                if (!uploadRes.ok) {
                    throw new Error(responseData.error || `PDF 업로드 실패 (${docTypes[i]})`)
                }
                console.log(`Upload ${i + 1} successful`);
            }

            // 업로드 및 케이스 생성이 완료되었으므로 화면 상태 초기화 및 서버 갱신
            // 서버 갱신 전 로컬 상태에 먼저 새 케이스를 띄워 체감 속도와 반영을 확실히 합니다.
            const createdSession = {
                ...newSession,
                documents: [] // 업로드된 문서는 나중에 새로고침 시 불러옴
            }
            setSessions(prev => [createdSession, ...prev])

            setSelectedSession(createdSession)
            setIsCreatingNew(false)
            setFormStatus('idle')
            router.refresh()

        } catch (err: any) {
            console.error("Case creation error:", err);
            alert(`오류 발생: ${err.message || '케이스 생성 실패 (서버 로그 확인 필요)'}`);
            setFormError(err.message || '케이스 생성에 실패했습니다.')
            setFormStatus('error')
        }
    }

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('이 케이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
        setIsDeletingId(id)
        try {
            await deleteSession(id)
            setSessions(prev => prev.filter(s => s.id !== id))
            if (selectedSession?.id === id) {
                setSelectedSession(null)
                setCompletion('')
            }
        } catch (err: any) {
            alert(`삭제 실패: ${err.message}`)
        } finally {
            setIsDeletingId(null)
        }
    }

    const handleGenerate = async () => {
        if (!selectedSession) return

        const docs = selectedSession.documents || []
        const resumeDoc = docs[0]
        const coverLetterDoc = docs[1]

        const student_data = `고객명: ${selectedSession.client_name || '미입력'}
지원 회사: ${selectedSession.target_company || '미입력'}
지원 직무: ${selectedSession.job_description_url_or_text || '미입력'}

[이력서 텍스트]
${resumeDoc?.parsed_text || '이력서 없음'}

[자기소개서 텍스트]
${coverLetterDoc?.parsed_text || '자기소개서 없음'}`

        await complete('', {
            body: {
                system_prompt: SYSTEM_PROMPT,
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
            router.refresh()
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
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-zinc-950">

            {/* 왼쪽 패널: 케이스 목록 */}
            <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-800">
                    <button
                        onClick={handleNewCase}
                        className="w-full py-2 px-3 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
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
                            className={`relative group p-3 border-b border-gray-100 dark:border-zinc-800 cursor-pointer transition-colors ${selectedSession?.id === s.id && !isCreatingNew
                                ? 'bg-blue-50 dark:bg-zinc-800 border-l-4 border-l-blue-500'
                                : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pr-6">
                                {s.client_name || '(이름 없음)'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {s.target_company || '-'}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${s.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                    {s.status === 'completed' ? '완료' : '진행중'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>

                            {/* 삭제 버튼 */}
                            <button
                                onClick={(e) => handleDeleteSession(s.id, e)}
                                disabled={isDeletingId === s.id}
                                className={`absolute top-2 right-2 p-1 rounded transition-all disabled:opacity-50 ${selectedSession?.id === s.id && !isCreatingNew
                                    ? 'text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                                    : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 border-gray-200 dark:hover:bg-red-900/20'
                                    }`}
                                title="케이스 삭제"
                            >
                                {isDeletingId === s.id ? (
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                ) : (
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 메인 콘텐츠 */}
            {isCreatingNew ? (
                <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
                    <div className="max-w-2xl mx-auto p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">새 컨설팅 케이스</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">고객 정보를 입력하고 이력서를 업로드하세요.</p>
                        </div>
                        <div className="space-y-5">
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
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    지원 직무 <span className="font-normal text-gray-400">(선택)</span>
                                </label>
                                <input
                                    type="text"
                                    value={jobDesc}
                                    onChange={(e) => setJobDesc(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="소프트웨어 엔지니어, 마케팅 기획 등"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    이력서 / 자기소개서 (PDF) <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    파일을 1개 또는 2개 선택하세요.
                                    <span className="text-blue-600 dark:text-blue-400 font-medium"> 첫 번째 파일 = 이력서, 두 번째 파일 = 자기소개서</span>
                                </p>
                                <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        multiple
                                        onChange={handleFileChange}
                                        className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 cursor-pointer"
                                    />
                                    {pdfFiles.length > 0 ? (
                                        <div className="mt-2 space-y-1">
                                            {pdfFiles.map((f, i) => (
                                                <p key={i} className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                                                    <span className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {i === 0 ? '이력서' : '자소서'}
                                                    </span>
                                                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-xs text-gray-400">PDF 파일을 선택하세요 (최대 2개)</p>
                                    )}
                                </div>
                            </div>
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                                    {formError}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCreateSession}
                                    disabled={formStatus === 'submitting'}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 shadow-sm"
                                >
                                    {formStatus === 'submitting' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                            PDF 처리 중...
                                        </span>
                                    ) : '케이스 생성'}
                                </button>
                                <button
                                    type="button"
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
                <div className="flex-1 flex h-full min-w-0 overflow-hidden">

                    {/* 가운데: 케이스 정보 */}
                    <div className="flex-1 border-r border-gray-200 dark:border-zinc-800 p-6 overflow-y-auto bg-white dark:bg-zinc-900">
                        <div className="mb-6 flex justify-between items-start gap-4">
                            <div>
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
                            <button
                                onClick={(e) => handleDeleteSession(selectedSession.id, e)}
                                disabled={isDeletingId === selectedSession.id}
                                className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 dark:bg-red-900/20 dark:border-red-800/50 dark:hover:bg-red-900/40 dark:text-red-400 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isDeletingId === selectedSession.id ? '삭제 중...' : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        케이스 삭제
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="space-y-6">
                            {selectedSession.documents?.length === 0 && (
                                <p className="text-sm text-gray-400 italic">첨부된 문서가 없습니다.</p>
                            )}
                            {selectedSession.documents?.map((doc, i) => (
                                <div key={i}>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${i === 0
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                            }`}>
                                            {i === 0 ? '이력서' : '자기소개서'}
                                        </span>
                                        {doc.file_url && (
                                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                                                className="text-blue-600 hover:underline text-xs normal-case font-normal">
                                                새 탭에서 열기 →
                                            </a>
                                        )}
                                    </h4>
                                    <div className="h-72 w-full border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-gray-100 dark:bg-black">
                                        <iframe src={doc.file_url} className="w-full h-full" title={i === 0 ? '이력서' : '자기소개서'} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 오른쪽: AI 패널 */}
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
                                        className={`flex-1 py-2 px-1 rounded-md text-xs font-semibold border transition-colors ${selectedModel === m.id
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

                        {/* 생성 버튼 */}
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3.5 rounded-lg text-lg font-bold disabled:opacity-50 transition-colors mb-5 shadow-md flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    생성 중...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    보고서 전체 생성하기
                                </>
                            )}
                        </button>

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
