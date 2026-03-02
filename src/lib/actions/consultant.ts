'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createConsultantSession(formData: FormData) {
    const supabase = await createClient()

    // 1. 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('로그인이 필요합니다.')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') throw new Error('컨설턴트 권한이 필요합니다.')

    const client_name = formData.get('client_name') as string | null
    const target_company = formData.get('company') as string
    const job_description = formData.get('job_description') as string | null
    const cover_letter_text = formData.get('cover_letter') as string | null

    if (!target_company) {
        throw new Error('회사명은 필수 입력 항목입니다.')
    }

    // 2. consulting_requests에 새 케이스 생성 (student_id = null, consultant이 직접 생성)
    const { data, error } = await supabase
        .from('consulting_requests')
        .insert({
            student_id: null,
            client_name: client_name || null,
            target_company,
            job_description_url_or_text: job_description || null,
            cover_letter_text: cover_letter_text || null,
            status: 'pending',
        })
        .select()
        .single()

    if (error || !data) {
        throw new Error(`케이스 생성 실패: ${error?.message}`)
    }

    revalidatePath('/consultant/workspace')
    return data
}

export async function deleteSession(requestId: string) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('로그인이 필요합니다.')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') throw new Error('컨설턴트 권한이 필요합니다.')

    // results → documents → consulting_requests 순서로 삭제 (FK 제약 대비)
    await supabase.from('results').delete().eq('request_id', requestId)
    await supabase.from('documents').delete().eq('request_id', requestId)

    const { error } = await supabase
        .from('consulting_requests')
        .delete()
        .eq('id', requestId)

    if (error) throw new Error(`삭제 실패: ${error.message}`)

    revalidatePath('/consultant/workspace')
    return { success: true }
}

export async function saveFinalResult(requestId: string, finalContent: string) {
    const supabase = await createClient()

    // 1. 컨설턴트 세션 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') throw new Error('Forbidden')

    // 2. results 테이블에 upsert
    const { data: existingResult } = await supabase
        .from('results')
        .select('id')
        .eq('request_id', requestId)
        .single()

    if (existingResult) {
        await supabase.from('results').update({ final_content: finalContent }).eq('id', existingResult.id)
    } else {
        await supabase.from('results').insert({ request_id: requestId, final_content: finalContent })
    }

    // 3. 요청 상태를 'completed'로 업데이트
    await supabase
        .from('consulting_requests')
        .update({ status: 'completed' })
        .eq('id', requestId)

    revalidatePath('/consultant/workspace')
    return { success: true }
}
