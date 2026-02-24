import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarFilter from '../components/SidebarFilter'
import NewsletterList from '../components/NewsletterList'

export default function Home() {
    const [papers, setPapers] = useState([])
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [days, setDays] = useState(7)
    const [date, setDate] = useState('')
    const [loading, setLoading] = useState(false)

    const fetchPapers = async () => {
        setLoading(true)
        try {
            const params = { search, category, limit: 20 }
            if (days !== '') params.days = days
            if (date !== '') params.date = date
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
    }, [search, category, days, date])

    return (
        <>
            <SidebarFilter
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                days={days}
                setDays={setDays}
                date={date}
                setDate={setDate}
            />
            <NewsletterList papers={papers} loading={loading} />
        </>
    )
}
