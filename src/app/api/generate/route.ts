import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

export async function POST(req: Request) {
    const supabase = await createClient()

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Validate consultant
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'consultant') return new Response('Forbidden', { status: 403 })

    const { system_prompt, student_data } = await req.json()

    if (!system_prompt || !student_data) {
        return new Response('Missing parameters', { status: 400 })
    }

    // Combine system prompt and student data
    // Following Task 3 instructions precisely
    const promptContent = `
SYSTEM PROMPT:
${system_prompt}

---
STUDENT DATA (Job Description & Resume Content):
${student_data}
---
Please generate the response according to the system prompt instructions based on the student data provided.
`

    const result = streamText({
        model: google('gemini-1.5-pro-latest'), // Use latest gemini model
        prompt: promptContent,
    })

    // Stream the response back
    return result.toTextStreamResponse()
}
