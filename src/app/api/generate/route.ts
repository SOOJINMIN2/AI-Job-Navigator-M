import { generateText } from 'ai'
import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
import { createAnthropic, anthropic } from '@ai-sdk/anthropic'
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

        const { system_prompt, student_data, model_provider, api_key } = await req.json()

        if (!system_prompt || !student_data) {
            return new Response('Missing parameters', { status: 400 })
        }

        const promptContent = `SYSTEM PROMPT:
${system_prompt}

---
STUDENT DATA (Job Description & Resume Content):
${student_data}
---
Please generate the response according to the system prompt instructions based on the student data provided.
`

        let selectedModel

        // Identify the API key type
        const isGoogleKey = api_key?.startsWith('AIza');
        const isAnthropicKey = api_key?.startsWith('sk-ant-');

        if (model_provider === 'claude-sonnet') {
            const provider = isAnthropicKey ? createAnthropic({ apiKey: api_key }) : anthropic;
            selectedModel = provider('claude-sonnet-4-5')
        } else if (model_provider === 'claude-haiku') {
            const provider = isAnthropicKey ? createAnthropic({ apiKey: api_key }) : anthropic;
            selectedModel = provider('claude-haiku-4-5')
        } else {
            // Default: Gemini 1.5 Pro
            const provider = isGoogleKey ? createGoogleGenerativeAI({ apiKey: api_key }) : google;
            selectedModel = provider('gemini-1.5-pro')
        }

        const { text } = await generateText({
            model: selectedModel,
            prompt: promptContent,
        })

        return new Response(text, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    } catch (e: any) {
        console.error("Generate API Error:", e)
        return new Response(`생성 오류: ${e.message}`, { status: 500 })
    }
}
