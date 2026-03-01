'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useRouter } from 'next/navigation'

type RequestData = {
    id: string
    status: string
    target_company: string
    created_at: string
    users: { full_name: string } | null
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'] // Blue, Emerald, Amber

export default function StatisticsDashboardClient({ requests }: { requests: RequestData[] }) {
    const [isExporting, setIsExporting] = useState(false)
    const router = useRouter()

    // 1. Process Data for the Status Pie Chart
    const statusCounts = requests.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const pieData = Object.keys(statusCounts).map(status => ({
        name: status.toUpperCase(),
        value: statusCounts[status]
    }))

    // 2. Process Data for the Company Bar Chart (Top 5)
    const companyCounts = requests.reduce((acc, req) => {
        const comp = req.target_company || 'Unknown'
        acc[comp] = (acc[comp] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const barData = Object.keys(companyCounts)
        .map(name => ({ name, count: companyCounts[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5

    // 3. Handle Google Sheets Export
    const handleExport = async () => {
        setIsExporting(true)
        try {
            const payload = requests.map(req => ({
                name: req.users?.full_name || 'Unknown',
                target_company: req.target_company,
                status: req.status,
                date: new Date(req.created_at).toLocaleDateString()
            }))

            const response = await fetch('/api/export/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicants: payload })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to export')
            }

            alert('Data successfully exported to Google Sheets!')
        } catch (err: any) {
            alert(`Export Failed: ${err.message}`)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Action Header */}
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Applicant Overview</h2>
                    <p className="text-sm text-gray-500 mt-1">Total Requests: {requests.length}</p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                    {isExporting ? 'Exporting...' : 'Export to Google Sheets'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pie Chart Card */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-6 text-center">Requests by Status</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart Card */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-6 text-center">Top Target Companies</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
