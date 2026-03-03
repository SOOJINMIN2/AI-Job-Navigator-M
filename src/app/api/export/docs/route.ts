import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        // 1. Authenticate Consultant
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: role } = await supabase.rpc('get_my_role')
        if (role !== 'consultant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        // 2. Parse request payload
        const { final_content, student_name } = await req.json()

        if (!final_content || !student_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 3. Authenticate with Google API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/documents'],
        })

        const docs = google.docs({ version: 'v1', auth })

        // 4. Create a new Google Document
        const createResponse = await docs.documents.create({
            requestBody: {
                title: `Consulting Report - ${student_name}`,
            },
        })

        const documentId = createResponse.data.documentId

        if (!documentId) {
            throw new Error("Failed to create Google Document")
        }

        // 5. Insert content into the new document
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        insertText: {
                            location: {
                                index: 1, // Start of document
                            },
                            text: `AI Job Navigator - Custom Consulting Report\n\nStudent: ${student_name}\nDate: ${new Date().toLocaleDateString()}\n\n---\n\n${final_content}\n`,
                        },
                    },
                ],
            },
        })

        // Return the URL for the frontend to open
        const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`

        return NextResponse.json({ success: true, url: documentUrl })

    } catch (error: any) {
        console.error('Google Docs Export Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to export to Google Docs' }, { status: 500 })
    }
}
