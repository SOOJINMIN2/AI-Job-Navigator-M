import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// @ts-ignore
import pdfParse from 'pdf-parse'

export const maxDuration = 60 // Allow more time for PDF parsing if needed

export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        // Authenticate user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const requestId = formData.get('request_id') as string
        const documentType = formData.get('document_type') as string || 'resume'

        if (!file || !requestId) {
            return NextResponse.json({ error: 'Missing required fields (file, request_id)' }, { status: 400 })
        }

        // 1. Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // 2. Parse text from PDF Buffer
        let parsedText = ''
        try {
            const pdfData = await pdfParse(buffer)

            // 3. Clean up extracted text (remove excessive whitespaces/newlines)
            parsedText = pdfData.text.replace(/\s+/g, ' ').trim()
        } catch (parseError: any) {
            console.error('PDF Parse Error:', parseError)
            return NextResponse.json({ error: 'Failed to extract text from PDF. It may be locked or an image-only scan.' }, { status: 422 })
        }

        // 4. Supabase Storage Upload
        // Path includes user ID and request ID for organization
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${user.id}/${requestId}/${safeFilename}`

        const { error: storageError } = await supabase.storage
            .from('documents')
            .upload(filePath, buffer, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (storageError) {
            console.error('Storage Upload Error:', storageError)
            return NextResponse.json({ error: 'Failed to upload document file' }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath)

        // 5. Database Insertion
        const { error: documentError } = await supabase
            .from('documents')
            .insert({
                request_id: requestId,
                file_url: publicUrl,
                parsed_text: parsedText,
                document_type: documentType
            })

        if (documentError) {
            console.error('Document DB Insert Error:', documentError)
            return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
        }

        // Success
        return NextResponse.json({ success: true, message: 'Document successfully parsed and stored.' })

    } catch (err: any) {
        console.error('Upload Endpoint Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
