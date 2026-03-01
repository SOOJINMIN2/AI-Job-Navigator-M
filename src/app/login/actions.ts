// src/app/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // 로그인 실패 시 (추후 에러 처리 UI 추가 가능)
    console.error('로그인 에러:', error.message)
    redirect('/login?error=Could not authenticate user')
  }

  // 로그인 성공 시 메인 페이지로 이동
  revalidatePath('/', 'layout')
  redirect('/')
}