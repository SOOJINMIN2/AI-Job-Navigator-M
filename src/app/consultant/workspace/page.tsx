import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkspaceUI from './WorkspaceUI'

export default async function ConsultantWorkspacePage() {
    const supabase = await createClient()

    // 1. 컨설턴트 권한 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') redirect('/login')

    // 2. 전체 케이스 조회 (pending + completed 모두)
    const { data: sessions } = await supabase
        .from('consulting_requests')
        .select(`
            id,
            client_name,
            target_company,
            job_description_url_or_text,
            cover_letter_text,
            status,
            created_at,
            documents ( file_url, parsed_text )
        `)
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen flex flex-col">
            <header className="h-16 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 flex items-center justify-between shadow-sm">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    AI Job Navigator — 컨설턴트 워크스페이스
                </h1>
                <form action="/auth/signout" method="post">
                    <button className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800">
                        로그아웃
                    </button>
                </form>
            </header>

            <main className="flex-1 bg-gray-50 dark:bg-zinc-950">
                <WorkspaceUI
                    initialSessions={sessions as any || []}
                />
            </main>
        </div>
    )
}
