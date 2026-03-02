import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
    const supabase = await createClient()

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/login')
    }

    // 2. Fetch User Role from public.users
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        // Profile not found - sign out and redirect to login
        await supabase.auth.signOut()
        redirect('/login')
    }

    // 3. Redirect to explicit routes based on Role
    if (profile.role === 'consultant') {
        redirect('/consultant/workspace')
    }

    // Default fallback for students
    redirect('/student/dashboard')
}
