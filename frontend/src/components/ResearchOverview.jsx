import React, { useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { BookOpen, Loader, Sparkles, RefreshCw } from 'lucide-react'

export default function ResearchOverview({ startDate, endDate }) {
    const [markdown, setMarkdown] = useState('')
    const [paperCount, setPaperCount] = useState(0)
    const [clusterCount, setClusterCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleGenerate = async () => {
        setLoading(true)
        setError('')
        try {
            const body = { start_date: startDate }
            if (endDate) body.end_date = endDate

            const res = await axios.post('/api/overview/generate', body)
            setMarkdown(res.data.markdown)
            setPaperCount(res.data.paper_count)
            setClusterCount(res.data.cluster_count)
        } catch (err) {
            console.error(err)
            setError(err.response?.data?.detail || 'Failed to generate overview. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="main-content">
                <div className="overview-loading glass-panel">
                    <div className="overview-loading-inner">
                        <Loader size={48} className="spin-animation" style={{ color: 'var(--primary-color)' }} />
                        <h2 style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Generating Research Overview
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 }}>
                            Clustering papers by category and synthesizing narratives with AI. This may take 30–60 seconds depending on the number of papers.
                        </p>
                        <div className="loading-steps">
                            <div className="loading-step active">
                                <Sparkles size={14} /> Clustering papers
                            </div>
                            <div className="loading-step">
                                <BookOpen size={14} /> Reading abstracts
                            </div>
                            <div className="loading-step">
                                <RefreshCw size={14} /> Synthesizing narrative
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!markdown) {
        return (
            <div className="main-content">
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Research Overview
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Generate an AI-powered narrative of recent research.</p>
                </div>

                <div className="overview-cta glass-panel">
                    <div className="overview-cta-inner">
                        <div className="overview-cta-icon">
                            <Sparkles size={40} />
                        </div>
                        <h2>Generate a Research Narrative</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
                            AI will cluster papers by category, analyze their abstracts, and write a coherent narrative overview of the research landscape for your selected time period.
                        </p>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
                            <span className="tag">{startDate || 'All time'}</span>
                            {endDate && <span className="tag">{endDate}</span>}
                        </div>

                        {error && (
                            <p style={{ color: '#f87171', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>
                        )}

                        <button className="btn btn-primary" onClick={handleGenerate} style={{ padding: '14px 32px', fontSize: '1rem' }}>
                            <Sparkles size={18} /> Generate Overview
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px' }}>
                        Research Overview
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {paperCount} papers · {clusterCount} categories
                    </p>
                </div>
                <button className="btn" onClick={handleGenerate} style={{ gap: '6px' }}>
                    <RefreshCw size={16} /> Regenerate
                </button>
            </div>

            <div className="overview-body glass-panel">
                <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
        </div>
    )
}
