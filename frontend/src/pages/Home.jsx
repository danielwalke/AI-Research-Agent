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
            />
            {showOverview ? (
                <ResearchOverview startDate={startDate} endDate={endDate} />
            ) : (
                <NewsletterList papers={papers} loading={loading} />
            )}
        </>
    )
}
