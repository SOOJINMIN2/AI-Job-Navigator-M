'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createStudentRequest(formData: FormData) {
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error('You must be logged in to create a request.')
    }

    const target_company = formData.get('target_company') as string
    const job_description = formData.get('job_description') as string
    const file = formData.get('document') as File

    if (!file || file.size === 0) {
        throw new Error('A document file is required.')
    }

    // 2. Create the consulting request
    const { data: requestData, error: requestError } = await supabase
        .from('consulting_requests')
        .insert({
            student_id: user.id,
            target_company,
            job_description_url_or_text: job_description,
            status: 'pending'
        })
        .select()
        .single()

    if (requestError || !requestData) {
        throw new Error(`Failed to create request: ${requestError?.message}`)
    }

    // 3. Upload File to Supabase Storage
    const filePath = `${user.id}/${requestData.id}/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

    if (storageError) {
        // Rollback
        await supabase.from('consulting_requests').delete().eq('id', requestData.id)
        throw new Error(`Failed to upload document: ${storageError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

    // 4. Save document record in the database
    const { error: documentError } = await supabase
        .from('documents')
        .insert({
            request_id: requestData.id,
            file_url: publicUrl,
            parsed_text: 'Text extraction pending or handled separately.',
            document_type: 'resume'
        })

    if (documentError) {
        console.error('Failed to create document record:', documentError)
    }

    revalidatePath('/student/dashboard')
    redirect('/student/dashboard')
}
