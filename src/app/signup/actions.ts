'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const full_name = formData.get('full_name') as string

  // 1. 컨설턴트 인원 제한 체크 (최대 50명)
  const { count, error: countError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'consultant')

  if (countError) {
    console.error('인원 확인 중 오류:', countError.message)
  }

  if (count !== null && count >= 50) {
    const errorMsg = '컨설턴트 인원이 가득 찼습니다. (최대 50명)'
    redirect(`/signup?error=${encodeURIComponent(errorMsg)}`)
  }

  // 2. 모든 신규 계정은 컨설턴트로 생성
  const role = 'consultant'

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        role,
      },
    },
  })

  if (error) {
    let errorMessage = error.message
    if (error.message === 'User already registered') {
      errorMessage = '이미 등록된 이메일입니다.'
    }
    console.error('회원가입 에러:', error.message)
    redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/consultant/workspace')
}
