import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarFilter from '../components/SidebarFilter'
import NewsletterList from '../components/NewsletterList'
import ResearchOverview from '../components/ResearchOverview'
import ArXivImporterModal from '../components/ArXivImporterModal'

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
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [skip, setSkip] = useState(0)
    const [showOverview, setShowOverview] = useState(false)
    const [isImporterOpen, setIsImporterOpen] = useState(false)

    const PAGE_SIZE = 20

    const fetchPapers = async (append = false) => {
        const currentSkip = append ? skip : 0
        if (append) {
            setLoadingMore(true)
        } else {
            setLoading(true)
        }
        try {
            const params = { search, category, limit: PAGE_SIZE, skip: currentSkip }
            if (startDate) params.start_date = startDate
            if (endDate) params.end_date = endDate
            const res = await axios.get('/api/papers/', { params })
            if (append) {
                setPapers(prev => [...prev, ...res.data])
            } else {
                setPapers(res.data)
            }
            setHasMore(res.data.length === PAGE_SIZE)
            setSkip(currentSkip + res.data.length)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }

    const handleLoadMore = () => {
        fetchPapers(true)
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
                onOpenImporter={() => setIsImporterOpen(true)}
            />
            {showOverview ? (
                <ResearchOverview startDate={startDate} endDate={endDate} search={search} category={category} />
            ) : (
                <NewsletterList papers={papers} loading={loading} hasMore={hasMore} onLoadMore={handleLoadMore} loadingMore={loadingMore} />
            )}
            <ArXivImporterModal 
                isOpen={isImporterOpen} 
                onClose={() => setIsImporterOpen(false)} 
                onImportSuccess={() => fetchPapers()} 
            />
        </>
    )
}

