import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        // 1. Authenticate Consultant
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (profile?.role !== 'consultant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        // 2. Parse request payload
        const { applicants } = await req.json()
        if (!applicants || !Array.isArray(applicants)) {
            return NextResponse.json({ error: 'Invalid payload: "applicants" array required' }, { status: 400 })
        }

        // 3. Authenticate with Google API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                // Handle properly if private key has escaped newlines
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        })

        const sheets = google.sheets({ version: 'v4', auth })
        const spreadsheetId = process.env.GOOGLE_SHEET_ID

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'GOOGLE_SHEET_ID not configured in environment' }, { status: 500 })
        }

        // 4. Format data for Google Sheets (2D Array)
        const values = applicants.map(app => [
            app.name || 'Unknown',
            app.target_company || 'N/A',
            app.status || 'pending',
            app.date || new Date().toLocaleDateString()
        ])

        // Wait until headers are established or just append directly
        // Assuming Sheet1 is the target
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:D',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        })

        return NextResponse.json({ success: true, message: 'Data exported successfully' })

    } catch (error: any) {
        console.error('Google Sheets Export Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to export to Google Sheets' }, { status: 500 })
    }
}
