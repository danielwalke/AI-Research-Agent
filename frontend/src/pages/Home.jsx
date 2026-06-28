import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarFilter from '../components/SidebarFilter'
import NewsletterList from '../components/NewsletterList'
import ResearchOverview from '../components/ResearchOverview'
import ArXivImporterModal from '../components/ArXivImporterModal'

export default function Home() {
    const [search, setSearch] = useState(() => sessionStorage.getItem('home_search') || '')
    const [category, setCategory] = useState(() => sessionStorage.getItem('home_category') || '')
    const [startDate, setStartDate] = useState(() => {
        const saved = sessionStorage.getItem('home_startDate');
        if (saved !== null) return saved;
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('home_endDate') || '')
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(() => sessionStorage.getItem('home_hasMore') === 'true')
    const [skip, setSkip] = useState(() => {
        const saved = sessionStorage.getItem('home_skip')
        return saved ? parseInt(saved, 10) : 0
    })
    const [showOverview, setShowOverview] = useState(() => sessionStorage.getItem('home_showOverview') === 'true')
    const [isImporterOpen, setIsImporterOpen] = useState(false)
    const [papers, setPapers] = useState(() => {
        const saved = sessionStorage.getItem('home_papers')
        return saved ? JSON.parse(saved) : []
    })

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
                setPapers(prev => {
                    const newPapers = [...prev, ...res.data];
                    sessionStorage.setItem('home_papers', JSON.stringify(newPapers));
                    return newPapers;
                })
            } else {
                setPapers(res.data)
                sessionStorage.setItem('home_papers', JSON.stringify(res.data));
                // Reset scroll position on new filter fetch
                sessionStorage.removeItem('home_scroll_top');
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.scrollTop = 0;
                }
            }
            const nextHasMore = res.data.length === PAGE_SIZE;
            const nextSkip = currentSkip + res.data.length;
            setHasMore(nextHasMore)
            setSkip(nextSkip)
            sessionStorage.setItem('home_hasMore', nextHasMore);
            sessionStorage.setItem('home_skip', nextSkip);
            sessionStorage.setItem('home_last_fetched_filters', JSON.stringify({ search, category, startDate, endDate }));
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

    // Sync filters and showOverview state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('home_search', search);
    }, [search]);

    useEffect(() => {
        sessionStorage.setItem('home_category', category);
    }, [category]);

    useEffect(() => {
        sessionStorage.setItem('home_startDate', startDate);
    }, [startDate]);

    useEffect(() => {
        sessionStorage.setItem('home_endDate', endDate);
    }, [endDate]);

    useEffect(() => {
        sessionStorage.setItem('home_showOverview', showOverview);
    }, [showOverview]);

    // Save scroll position on scroll event dynamically to avoid unmount data loss
    useEffect(() => {
        const handleScroll = (e) => {
            sessionStorage.setItem('home_scroll_top', e.target.scrollTop);
        };
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (mainContent) {
                mainContent.removeEventListener('scroll', handleScroll);
            }
        };
    }, [papers, loading]);

    // Restore scroll position after papers render
    useEffect(() => {
        if (papers.length > 0 && !loading) {
            const savedScroll = sessionStorage.getItem('home_scroll_top');
            if (savedScroll) {
                setTimeout(() => {
                    const mainContent = document.querySelector('.main-content');
                    if (mainContent) {
                        mainContent.scrollTop = parseInt(savedScroll, 10);
                    }
                }, 50);
            }
        }
    }, [papers, loading]);

    // Trigger paper fetch when filters change
    useEffect(() => {
        const savedFilters = sessionStorage.getItem('home_last_fetched_filters');
        const currentFilters = JSON.stringify({ search, category, startDate, endDate });
        
        if (savedFilters === currentFilters && papers.length > 0) {
            return;
        }

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

