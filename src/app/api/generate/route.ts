import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: Request) {
    const supabase = await createClient()

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Validate consultant
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') return new Response('Forbidden', { status: 403 })

    const { system_prompt, student_data, model_provider } = await req.json()

    if (!system_prompt || !student_data) {
        return new Response('Missing parameters', { status: 400 })
    }

    const promptContent = `
SYSTEM PROMPT:
${system_prompt}

---
STUDENT DATA (Job Description & Resume Content):
${student_data}
---
Please generate the response according to the system prompt instructions based on the student data provided.
`

    let selectedModel
    if (model_provider === 'claude-sonnet') {
        selectedModel = anthropic('claude-sonnet-4-6')
    } else if (model_provider === 'claude-haiku') {
        selectedModel = anthropic('claude-haiku-4-5-20251001')
    } else {
        // Default: Gemini
        selectedModel = google('gemini-1.5-pro-latest')
    }

    const result = streamText({
        model: selectedModel,
        prompt: promptContent,
    })

    return result.toTextStreamResponse()
}
