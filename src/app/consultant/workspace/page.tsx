import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkspaceUI from './WorkspaceUI'

export default async function ConsultantWorkspacePage() {
    const supabase = await createClient()

    // 1. Validate Consultant access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') redirect('/student/dashboard')

    // 2. Fetch pending requests with user names and their uploaded documents
    // Assuming one document per request for now based on the form
    const { data: requests } = await supabase
        .from('consulting_requests')
        .select(`
      id,
      target_company,
      job_description_url_or_text,
      status,
      created_at,
      users ( full_name ),
      documents ( file_url, parsed_text )
    `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    // 3. Fetch consultant's prompts
    const { data: prompts } = await supabase
        .from('ai_prompts')
        .select('id, title, category, system_prompt')
        .order('created_at', { ascending: false })

    return (
        <div className="min-h-screen flex flex-col">
            <header className="h-20 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-8 flex items-center justify-between shadow-sm">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    Consultant Workspace
                </h1>
                <form action="/auth/signout" method="post">
                    <button className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        Sign out
                    </button>
                </form>
            </header>

            {/* Renders the complex UI taking over the remainder of the viewport */}
            <main className="flex-1 bg-gray-50 dark:bg-zinc-950">
                <WorkspaceUI
                    requests={requests as any || []}
                    prompts={prompts || []}
                />
            </main>
        </div>
    )
}
