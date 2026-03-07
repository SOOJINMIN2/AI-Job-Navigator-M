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
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return { success: false, error: '로그인이 필요합니다.' }

        const { data: role } = await supabase.rpc('get_my_role')
        if (role !== 'consultant') return { success: false, error: '컨설턴트 권한이 필요합니다.' }

        const res1 = await supabase.from('results').delete().eq('request_id', requestId)
        if (res1.error) return { success: false, error: res1.error.message }

        const res2 = await supabase.from('documents').delete().eq('request_id', requestId)
        if (res2.error) return { success: false, error: res2.error.message }

        const { error } = await supabase
            .from('consulting_requests')
            .delete()
            .eq('id', requestId)

        if (error) return { success: false, error: error.message }

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function saveFinalResult(requestId: string, finalContent: string) {
    try {
        const supabase = await createClient()

        // 1. 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('로그인이 필요합니다.')

        const { data: role } = await supabase.rpc('get_my_role')
        if (role !== 'consultant') throw new Error('컨설턴트 권한이 필요합니다.')

        // 2. results 테이블에 upsert
        // 기존에 결과가 있는지 확인
        const { data: existingResult, error: selectError } = await supabase
            .from('results')
            .select('id')
            .eq('request_id', requestId)
            .maybeSingle()

        if (selectError) {
            throw new Error(`결과 조회 중 오류: ${selectError.message}`)
        }

        if (existingResult) {
            const { error: updateError } = await supabase
                .from('results')
                .update({
                    final_content: finalContent,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingResult.id)

            if (updateError) throw new Error(`결과 업데이트 실패: ${updateError.message}`)
        } else {
            const { error: insertError } = await supabase
                .from('results')
                .insert({
                    request_id: requestId,
                    final_content: finalContent
                })

            if (insertError) throw new Error(`결과 저장 실패: ${insertError.message}`)
        }

        // 3. 요청 상태를 'completed'로 업데이트
        const { error: statusError } = await supabase
            .from('consulting_requests')
            .update({ status: 'completed' })
            .eq('id', requestId)

        if (statusError) {
            throw new Error(`상태 업데이트 실패: ${statusError.message}`)
        }

        revalidatePath('/consultant/workspace')
        revalidatePath(`/student/result/${requestId}`)
        return { success: true }
    } catch (err: any) {
        console.error('saveFinalResult error:', err)
        throw err
    }
}
