import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return new Response(`Unauthorized: ${authError?.message || 'No user'}`, { status: 401 })

        // Validate consultant
        const { data: role, error: rpcError } = await supabase.rpc('get_my_role')
        if (rpcError) return new Response(`Role Verification Error: ${rpcError.message}`, { status: 500 })
        if (role !== 'consultant') return new Response(`Forbidden: User is not a consultant (role: ${role})`, { status: 403 })

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
            selectedModel = anthropic('claude-3-5-sonnet-latest')
        } else if (model_provider === 'claude-haiku') {
            selectedModel = anthropic('claude-3-5-haiku-latest')
        } else {
            // Default: Gemini
            selectedModel = google('gemini-1.5-pro-latest')
        }

        const result = streamText({
            model: selectedModel,
            prompt: promptContent,
        })

        return result.toTextStreamResponse()
    } catch (e: any) {
        console.error("Generate API Error:", e)
        return new Response(`Server Generation Error: ${e.message}`, { status: 500 })
    }
}
