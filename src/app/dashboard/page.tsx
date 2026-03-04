import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
    const supabase = await createClient()

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/login')
    }

    // 2. Get role via RPC (통일된 방식)
    const { data: role } = await supabase.rpc('get_my_role')

    // 3. Redirect based on Role
    if (role === 'consultant') {
        redirect('/consultant/workspace')
    }

    // Default fallback for students
    redirect('/student/dashboard')
}
