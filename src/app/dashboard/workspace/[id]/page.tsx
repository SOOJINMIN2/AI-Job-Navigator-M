import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

// Since the folder is [id], params.id is available
export default async function WorkspacePage({ params }: { params: { id: string } }) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'consultant') {
        redirect('/dashboard')
    }

    // 1. Fetch Consulting Request
    const { data: request } = await supabase
        .from('consulting_requests')
        .select(`
      id,
      target_company,
      documents ( id, parsed_text )
    `)
        .eq('id', params.id)
        .single()

    if (!request || !request.documents || request.documents.length === 0) {
        return <div>Request or document not found.</div>
    }

    // 2. Fetch Prompts for Consultant to use
    const { data: prompts } = await supabase
        .from('ai_prompts')
        .select('id, title, category')
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen p-8 bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold dark:text-gray-100">
                        Consulting Workspace
                    </h1>
                    <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        Back to Dashboard
                    </a>
                </header>

                {/* Pass data to interactive client component */}
                <WorkspaceClient
                    requestId={request.id}
                    targetCompany={request.target_company}
                    documentId={request.documents[0].id}
                    prompts={prompts || []}
                />
            </div>
        </div>
    )
}
