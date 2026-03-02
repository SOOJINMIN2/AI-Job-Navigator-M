import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
    const supabase = await createClient()

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/login')
    }

    // 2. Get role from user metadata (set during signup)
    //    Fallback to public.users if metadata role is missing
    let role = user.user_metadata?.role as string | undefined

    if (!role) {
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
        role = profile?.role
    }

    // 3. Redirect based on Role
    if (role === 'consultant') {
        redirect('/consultant/workspace')
    }

    // Default fallback for students
    redirect('/student/dashboard')
}
