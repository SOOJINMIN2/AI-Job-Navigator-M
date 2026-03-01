'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import pdfParse from 'pdf-parse'

export async function createConsultingRequest(formData: FormData) {
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error('You must be logged in to create a request.')
    }

    const target_company = formData.get('target_company') as string
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
            status: 'pending'
        })
        .select()
        .single()

    if (requestError || !requestData) {
        throw new Error(`Failed to create request: ${requestError?.message}`)
    }

    // 3. Upload File to Supabase Storage
    // We'll use a path like: {user_id}/{request_id}/{filename}
    const filePath = `${user.id}/${requestData.id}/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

    if (storageError) {
        // Rollback the request if storage fails
        await supabase.from('consulting_requests').delete().eq('id', requestData.id)
        throw new Error(`Failed to upload document: ${storageError.message}`)
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

    // 4. Parse the PDF server-side using pdf-parse
    let parsed_text = ''
    try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const pdfData = await pdfParse(buffer)
        parsed_text = pdfData.text
    } catch (parseError) {
        console.error('Error parsing PDF:', parseError)
        // We can decide to either fail the whole process, or store it without text.
        // For now, we store empty text if parsing fails (or handle the error gracefully).
        parsed_text = 'Error extracting text. Document may be scanned or locked.'
    }

    // 5. Save document record in the database
    const { error: documentError } = await supabase
        .from('documents')
        .insert({
            request_id: requestData.id,
            file_url: publicUrl,
            parsed_text,
            document_type: 'resume' // Can be made dynamic later
        })

    if (documentError) {
        console.error('Failed to create document record:', documentError)
    }

    revalidatePath('/dashboard')
    redirect('/dashboard')
}
