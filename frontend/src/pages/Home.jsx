import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarFilter from '../components/SidebarFilter'
import NewsletterList from '../components/NewsletterList'
import ResearchOverview from '../components/ResearchOverview'

export default function Home() {
    const [papers, setPapers] = useState([])
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [fetchingPapers, setFetchingPapers] = useState(false)
    const [fetchMessage, setFetchMessage] = useState('')

    const fetchPapers = async () => {
        setLoading(true)
        try {
            const params = { search, category, limit: 20 }
            if (startDate) params.start_date = startDate
            if (endDate) params.end_date = endDate
            const res = await axios.get('/api/papers/', { params })
            setPapers(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchPapers()
        }, 500)
        return () => clearTimeout(delayDebounceFn)
    }, [search, category, startDate, endDate])

    const handleFetchRange = async () => {
        if (!startDate) return
        setFetchingPapers(true)
        setFetchMessage('Starting ArXiv fetch...')

        try {
            const body = {
                start_date: startDate,
                end_date: endDate || new Date().toISOString().split('T')[0],
            }
            if (category) body.category = category

            const response = await fetch('/api/papers/fetch-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                let errDetail = 'Failed to fetch papers.'
                try {
                    const errData = await response.json()
                    errDetail = errData.detail || errDetail
                } catch (e) {}
                throw new Error(errDetail)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n\n')
                buffer = parts.pop() || ''

                for (const part of parts) {
                    const line = part.trim()
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim()
                        if (!dataStr) continue

                        const data = JSON.parse(dataStr)
                        if (data.status === 'processing') {
                            setFetchMessage(data.message || 'Fetching papers...')
                        } else if (data.status === 'complete') {
                            setFetchMessage(`Done! ${data.new_papers} new papers fetched.`)
                            // Refresh paper list
                            setTimeout(() => {
                                fetchPapers()
                                setFetchingPapers(false)
                                setFetchMessage('')
                            }, 2000)
                        } else if (data.status === 'error') {
                            throw new Error(data.detail || 'Server encountered an error.')
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setFetchMessage(`Error: ${err.message}`)
            setTimeout(() => {
                setFetchingPapers(false)
                setFetchMessage('')
            }, 3000)
        }
    }

    return (
        <>
            <SidebarFilter
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                showOverview={showOverview}
                setShowOverview={setShowOverview}
                onFetchRange={handleFetchRange}
                fetchingPapers={fetchingPapers}
                fetchMessage={fetchMessage}
            />
            {showOverview ? (
                <ResearchOverview startDate={startDate} endDate={endDate} search={search} category={category} />
            ) : (
                <NewsletterList papers={papers} loading={loading} />
            )}
        </>
    )
}

