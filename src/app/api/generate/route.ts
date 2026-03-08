import { streamText } from 'ai'
import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
import { createAnthropic, anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

// 안정적인 생성을 위해 Node.js runtime 사용 (Supabase 인증 클라이언트와의 호환성 보장)
export const maxDuration = 60

export async function POST(req: Request) {
    try {
        console.log("Generate API called...");
        const supabase = await createClient()

        // 1. 사용자 인증 확인 (항상 getUser() 사용 권장)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error("Auth Error:", authError?.message);
            return new Response(`Unauthorized: ${authError?.message || '로그인이 필요합니다.'}`, { status: 401 })
        }

        // 2. 컨설턴트 권한 확인
        const { data: role, error: rpcError } = await supabase.rpc('get_my_role')
        if (rpcError) {
            console.error("RPC Error (get_my_role):", rpcError.message);
            return new Response(`Error verifying role: ${rpcError.message}`, { status: 500 })
        }
        
        if (role !== 'consultant') {
            console.warn(`Access denied for role: ${role}`);
            return new Response(`Forbidden: ${role} 권한은 이 작업을 수행할 수 없습니다.`, { status: 403 })
        }

        const { system_prompt, student_data, model_provider, api_key } = await req.json()

        if (!system_prompt || !student_data) {
            return new Response('필수 정보(프롬프트 또는 데이터)가 누락되었습니다.', { status: 400 })
        }

        // 3. AI 모델 선택 및 프로바이더 초기화
        let selectedModel
        const isGoogleKey = api_key?.startsWith('AIza');
        const isAnthropicKey = api_key?.startsWith('sk-ant-');

        console.log(`Using model provider: ${model_provider}, has custom API key: ${!!api_key}`);

        if (model_provider === 'claude-sonnet') {
            const provider = isAnthropicKey ? createAnthropic({ apiKey: api_key }) : anthropic;
            selectedModel = provider('claude-3-5-sonnet-20240620')
        } else if (model_provider === 'claude-haiku') {
            const provider = isAnthropicKey ? createAnthropic({ apiKey: api_key }) : anthropic;
            selectedModel = provider('claude-3-5-haiku-20241022')
        } else {
            // Default: Gemini 2.0 Flash
            const provider = isGoogleKey ? createGoogleGenerativeAI({ apiKey: api_key }) : google;
            selectedModel = provider('gemini-2.0-flash')
        }

        // 4. 스트리밍 방식으로 텍스트 생성 시작
        const result = await streamText({
            model: selectedModel,
            system: system_prompt,
            prompt: student_data,
        })

        // 텍스트 스트림 응답
        return result.toTextStreamResponse()

    } catch (e: any) {
        console.error("Critical AI Generation Error:", e)
        return new Response(`보고서 생성 중 오류가 발생했습니다: ${e.message}`, { status: 500 })
    }
}
