import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarFilter from '../components/SidebarFilter'
import NewsletterList from '../components/NewsletterList'

export default function Home() {
    const [papers, setPapers] = useState([])
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [loading, setLoading] = useState(false)

    const fetchPapers = async () => {
        setLoading(true)
        try {
            const res = await axios.get('http://localhost:8080/api/papers/', {
                params: { search, category, limit: 20 }
            })
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
    }, [search, category])

    return (
        <>
            <SidebarFilter
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
            />
            <NewsletterList papers={papers} loading={loading} />
        </>
    )
}
