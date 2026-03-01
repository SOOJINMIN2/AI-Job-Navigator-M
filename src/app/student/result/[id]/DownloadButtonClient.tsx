'use client'

import { PDFDownloadLink } from '@react-pdf/renderer'
import { ConsultingReportPDF } from './ConsultingReportPDF'
import { useEffect, useState } from 'react'

type DownloadProps = {
    studentName: string
    targetCompany: string
    finalContent: string
    date: string
}

export default function DownloadButtonClient({ studentName, targetCompany, finalContent, date }: DownloadProps) {
    // We need to render this only on the client due to PDF renderer requirements
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    if (!isClient) {
        return (
            <button disabled className="w-full flex justify-center rounded-md bg-indigo-50 px-3 py-3 text-sm font-semibold text-indigo-400 shadow-sm border border-indigo-200">
                Preparing Document Generator...
            </button>
        )
    }

    return (
        <PDFDownloadLink
            document={
                <ConsultingReportPDF
                    studentName={studentName}
                    targetCompany={targetCompany}
                    finalContent={finalContent}
                    date={date}
                />
            }
            fileName={`Consulting_Report_${targetCompany.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
            className="w-full block"
        >
            {({ blob, url, loading, error }) => (
                <button
                    disabled={loading}
                    className="w-full flex justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Generating PDF Blob...
                        </>
                    ) : 'Download PDF Report'}
                </button>
            )}
        </PDFDownloadLink>
    )
}
