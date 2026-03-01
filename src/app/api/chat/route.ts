import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
    const supabase = await createClient()

    // Verify authentication and role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'consultant') {
        return new Response('Forbidden', { status: 403 })
    }

    const { promptId, documentId, requestDetails } = await req.json()

    // 1. Fetch the Prompt from Supabase
    const { data: promptData, error: promptError } = await supabase
        .from('ai_prompts')
        .select('system_prompt')
        .eq('id', promptId)
        .single()

    if (promptError || !promptData) {
        return new Response('Prompt not found', { status: 404 })
    }

    // 2. Fetch the Document from Supabase
    const { data: documentData, error: docError } = await supabase
        .from('documents')
        .select('parsed_text')
        .eq('id', documentId)
        .single()

    if (docError || !documentData) {
        return new Response('Document not found', { status: 404 })
    }

    // 3. Construct the comprehensive context for Gemini
    const systemInstruction = promptData.system_prompt
    const userContent = `
---
TARGET ROLE & COMPANY INFO:
${requestDetails}

---
USER RESUME/DOCUMENT TEXT:
${documentData.parsed_text}
---

Please execute the system instructions using the context above.
`

    // 4. Stream response using Google Gemini models via Vercel AI SDK
    const result = streamText({
        model: google('gemini-1.5-pro-latest'), // Use pro or flash as preferred
        system: systemInstruction,
        prompt: userContent,
    })

    return result.toTextStreamResponse()
}
