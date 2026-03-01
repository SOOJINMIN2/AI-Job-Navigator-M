'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const full_name = formData.get('full_name') as string
    const role = formData.get('role') as string

    // The raw_user_meta_data will be picked up by the Supabase DB trigger we set up
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name,
                role,
            }
        }
    })

    // We are redirecting to login since email confirmation is standard, 
    // or they can just log in if it's disabled on the project
    if (error) {
        redirect('/signup?error=Could not create user')
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard') // Or to a confirmation page depending on Supabase settings
}
