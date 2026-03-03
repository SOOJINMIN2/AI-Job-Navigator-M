import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    // getUser()로 확인 (getSession 대신 - 서버 사이드에서 보안상 안전)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        await supabase.auth.signOut()
    }

    return NextResponse.redirect(new URL('/', request.url), {
        status: 302,
    })
}
