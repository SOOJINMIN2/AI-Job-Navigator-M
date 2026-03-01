'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPrompt(formData: FormData) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error('Not authenticated')
    }

    // Ensure user is consultant
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'consultant') {
        throw new Error('Unauthorized')
    }

    const category = formData.get('category') as string
    const title = formData.get('title') as string
    const system_prompt = formData.get('system_prompt') as string

    const { error } = await supabase
        .from('ai_prompts')
        .insert({
            category,
            title,
            system_prompt,
            created_by: user.id
        })

    if (error) {
        console.error('Error creating prompt:', error)
        throw new Error('Failed to create prompt')
    }

    revalidatePath('/dashboard/prompts')
    revalidatePath('/dashboard')
}
