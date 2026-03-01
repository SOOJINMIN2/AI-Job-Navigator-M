'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveFinalResult(requestId: string, finalContent: string) {
    const supabase = await createClient()

    // 1. Verify consultant session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'consultant') throw new Error('Forbidden')

    // 2. Upsert into results table
    // We check if a result already exists to either insert or update
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

    // 3. Update request status to 'completed'
    await supabase
        .from('consulting_requests')
        .update({ status: 'completed' })
        .eq('id', requestId)

    revalidatePath('/consultant/workspace')
    return { success: true }
}
