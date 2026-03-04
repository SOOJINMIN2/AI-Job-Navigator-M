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
    console.error('로그인 에러:', error.message)
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // 로그인 성공 시 역할 기반 라우팅 (dashboard에서 역할 판단)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
