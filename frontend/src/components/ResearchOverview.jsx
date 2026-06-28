import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { BookOpen, Loader, Sparkles, RefreshCw, Send, Bot, User, MessageSquare, Mic, Download, Play, Pause, Volume2, ChevronDown } from 'lucide-react'

export default function ResearchOverview({ startDate, endDate, search, category }) {
    const currentFiltersKey = JSON.stringify({ startDate, endDate, search, category });
    const savedFiltersKey = sessionStorage.getItem('overview_last_filters');
    const isSameFilters = currentFiltersKey === savedFiltersKey;

    const [markdown, setMarkdown] = useState(() => {
        return isSameFilters ? (sessionStorage.getItem('overview_markdown') || '') : '';
    });
    const [paperCount, setPaperCount] = useState(() => {
        return isSameFilters ? parseInt(sessionStorage.getItem('overview_paperCount') || '0', 10) : 0;
    });
    const [clusterCount, setClusterCount] = useState(() => {
        return isSameFilters ? parseInt(sessionStorage.getItem('overview_clusterCount') || '0', 10) : 0;
    });
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [mode, setMode] = useState('digest')
    const [papersList, setPapersList] = useState(() => {
        const saved = sessionStorage.getItem('overview_papersList');
        return isSameFilters && saved ? JSON.parse(saved) : [];
    });

    // Chat state
    const [chatMessages, setChatMessages] = useState(() => {
        const saved = sessionStorage.getItem('overview_chatMessages');
        return isSameFilters && saved ? JSON.parse(saved) : [];
    });
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [showChat, setShowChat] = useState(() => {
        return isSameFilters ? sessionStorage.getItem('overview_showChat') === 'true' : false;
    });

    // Podcast state
    const [podcastLoading, setPodcastLoading] = useState(false)
    const [podcastUrl, setPodcastUrl] = useState(() => {
        return isSameFilters ? (sessionStorage.getItem('overview_podcastUrl') || '') : '';
    });
    const [podcastError, setPodcastError] = useState('')
    const [podcastStatus, setPodcastStatus] = useState('')

    // Progress loading state
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [currentLoadingCategory, setCurrentLoadingCategory] = useState('')

    const audioRef = useRef(null)
    const navigate = useNavigate()

    // Auto-detect mode based on date range (trends for > 30 days or all time)
    useEffect(() => {
        if (startDate) {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date();
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 30) {
                setMode('trends');
            } else {
                setMode('digest');
            }
        } else {
            setMode('trends');
        }
    }, [startDate, endDate]);

    const handleGenerate = async () => {
        setLoading(true)
        setError('')
        setChatMessages([])
        setPodcastUrl('')
        setPodcastError('')
        setMarkdown('')
        setLoadingProgress(0)
        setCurrentLoadingCategory('Initializing...')
        sessionStorage.removeItem('overview_scroll_top') // clear scroll
        try {
            const body = { start_date: startDate }
            if (endDate) body.end_date = endDate
            if (search) body.search = search
            if (category) body.category = category
            body.mode = mode

            const response = await fetch('/api/overview/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                let errDetail = 'Failed to generate overview.';
                try {
                     const errData = await response.json();
                     errDetail = errData.detail || errDetail;
                } catch(e) {}
                throw new Error(errDetail);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (!dataStr) continue;
                        
                        const data = JSON.parse(dataStr);
                        if (data.status === 'processing') {
                            if (data.progress !== undefined) setLoadingProgress(data.progress);
                            if (data.current_category) setCurrentLoadingCategory(data.current_category);
                        } else if (data.status === 'generating' || data.status === 'synthesizing' || data.status === 'finishing') {
                            if (data.progress !== undefined) setLoadingProgress(data.progress);
                            if (data.current_category) setCurrentLoadingCategory(data.current_category);
                        } else if (data.status === 'complete' && data.result) {
                            setMarkdown(data.result.markdown);
                            setPaperCount(data.result.paper_count);
                            setClusterCount(data.result.cluster_count);
                            setPapersList(data.result.papers || []);
                            setShowChat(true);
                            setLoadingProgress(100);
                            setCurrentLoadingCategory('Complete');
                        } else if (data.status === 'error') {
                            throw new Error(data.detail || 'Server encountered an error.');
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setError(err.message || 'Failed to generate overview. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Sync overview state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('overview_markdown', markdown);
        if (markdown) {
            sessionStorage.setItem('overview_last_filters', JSON.stringify({ startDate, endDate, search, category }));
        }
    }, [markdown, startDate, endDate, search, category]);

    useEffect(() => {
        sessionStorage.setItem('overview_paperCount', paperCount);
    }, [paperCount]);

    useEffect(() => {
        sessionStorage.setItem('overview_clusterCount', clusterCount);
    }, [clusterCount]);

    useEffect(() => {
        sessionStorage.setItem('overview_papersList', JSON.stringify(papersList));
    }, [papersList]);

    useEffect(() => {
        sessionStorage.setItem('overview_chatMessages', JSON.stringify(chatMessages));
    }, [chatMessages]);

    useEffect(() => {
        sessionStorage.setItem('overview_showChat', showChat);
    }, [showChat]);

    useEffect(() => {
        sessionStorage.setItem('overview_podcastUrl', podcastUrl);
    }, [podcastUrl]);

    // Save scroll on scroll event dynamically to avoid unmount data loss
    useEffect(() => {
        const handleScroll = (e) => {
            sessionStorage.setItem('overview_scroll_top', e.target.scrollTop);
        };
        const overviewPanel = document.querySelector('.overview-narrative-panel');
        if (overviewPanel) {
            overviewPanel.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (overviewPanel) {
                overviewPanel.removeEventListener('scroll', handleScroll);
            }
        };
    }, [markdown, loading]);

    // Restore scroll after markdown render
    useEffect(() => {
        if (markdown && !loading) {
            const savedScroll = sessionStorage.getItem('overview_scroll_top');
            if (savedScroll) {
                setTimeout(() => {
                    const overviewPanel = document.querySelector('.overview-narrative-panel');
                    if (overviewPanel) {
                        overviewPanel.scrollTop = parseInt(savedScroll, 10);
                    }
                }, 50);
            }
        }
    }, [markdown, loading]);

    const handleChatSend = async () => {
        if (!chatInput.trim() || chatLoading) return
        const newMsg = { role: 'user', content: chatInput }
        const updatedMessages = [...chatMessages, newMsg]
        setChatMessages(updatedMessages)
        setChatInput('')
        setChatLoading(true)

        try {
            const res = await axios.post('/api/overview/chat', {
                overview_markdown: markdown,
                messages: updatedMessages,
            })
            setChatMessages([...updatedMessages, { role: 'assistant', content: res.data.reply }])
        } catch (err) {
            console.error(err)
            setChatMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, I encountered an error.' }])
        } finally {
            setChatLoading(false)
        }
    }

    const handleGeneratePodcast = async () => {
        if (podcastLoading || !markdown) return
        setPodcastLoading(true)
        setPodcastError('')
        setPodcastUrl('')
        setPodcastStatus('Generating podcast script...')

        try {
            const response = await fetch('/api/overview/podcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overview_markdown: markdown }),
            });

            if (!response.ok) {
                let errDetail = 'Failed to generate podcast.';
                try {
                    const errData = await response.json();
                    errDetail = errData.detail || errDetail;
                } catch(e) {}
                throw new Error(errDetail);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (!dataStr) continue;

                        const data = JSON.parse(dataStr);
                        if (data.status === 'generating_script') {
                            setPodcastStatus('Writing podcast script with AI...');
                        } else if (data.status === 'processing') {
                            setPodcastStatus('Synthesizing audio...');
                        } else if (data.status === 'complete') {
                            setPodcastUrl(data.result.audio_url);
                            setPodcastStatus('');
                        } else if (data.status === 'error') {
                            throw new Error(data.detail || 'Failed to generate podcast.');
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
            setPodcastError(err.message || 'Failed to generate podcast.')
            setPodcastStatus('')
        } finally {
            setPodcastLoading(false)
        }
    }

    // Build filter description for CTA
    const filterDesc = []
    if (startDate) filterDesc.push(startDate)
    if (endDate) filterDesc.push(`to ${endDate}`)
    if (category) filterDesc.push(category)
    if (search) filterDesc.push(`"${search}"`)

    if (loading) {
        const progressPercent = loadingProgress || 0;
        const isClusteringActive = progressPercent < 10;
        const isReadingActive = progressPercent >= 10 && progressPercent < 85;
        const isSynthesizingActive = progressPercent >= 85;

        return (
            <div className="main-content">
                <div className="overview-loading glass-panel">
                    <div className="overview-loading-inner" style={{ width: '100%', maxWidth: '500px' }}>
                        <Loader size={48} className="spin-animation" style={{ color: 'var(--primary-color)', marginBottom: '8px' }} />
                        <h2 style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center' }}>
                            Generating Research Overview
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6, fontSize: '0.95rem' }}>
                            Clustering papers by category and synthesizing narratives with AI.
                        </p>
                        
                        {/* Premium Glassmorphic Progress Bar */}
                        <div style={{ width: '100%', marginTop: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '500' }}>
                                    {currentLoadingCategory ? `Processing: ${currentLoadingCategory}` : 'Initializing...'}
                                </span>
                                <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{progressPercent}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                border: '1px solid var(--surface-border)'
                            }}>
                                <div style={{
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))',
                                    boxShadow: '0 0 8px var(--primary-glow)',
                                    borderRadius: '4px',
                                    transition: 'width 0.4s ease-out'
                                }} />
                            </div>
                        </div>

                        <div className="loading-steps" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                            <div className={`loading-step ${isClusteringActive ? 'active' : ''}`} style={{ opacity: isClusteringActive ? 1 : 0.4 }}>
                                <Sparkles size={14} /> Clustering papers
                            </div>
                            <div className={`loading-step ${isReadingActive ? 'active' : ''}`} style={{ opacity: isReadingActive ? 1 : 0.4 }}>
                                <BookOpen size={14} /> Reading abstracts
                            </div>
                            <div className={`loading-step ${isSynthesizingActive ? 'active' : ''}`} style={{ opacity: isSynthesizingActive ? 1 : 0.4 }}>
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
                            AI will analyze the papers matching your current filters and write a coherent narrative overview. You can then chat with the overview to explore insights.
                        </p>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
                            {filterDesc.map((f, i) => (
                                <span key={i} className="tag">{f}</span>
                            ))}
                            {filterDesc.length === 0 && <span className="tag">All papers</span>}
                        </div>

                        {/* Overview Mode Selector */}
                        <div className="overview-mode-selector">
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Select Overview Style:</label>
                            <div className="mode-selector-tabs">
                                <button
                                    type="button"
                                    className={`mode-selector-btn ${mode === 'digest' ? 'active' : ''}`}
                                    onClick={() => setMode('digest')}
                                >
                                    Detailed Digest
                                </button>
                                <button
                                    type="button"
                                    className={`mode-selector-btn ${mode === 'trends' ? 'active' : ''}`}
                                    onClick={() => setMode('trends')}
                                >
                                    Trend Analysis
                                </button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', maxWidth: '400px', textAlign: 'center', marginTop: '4px', lineHeight: 1.4 }}>
                                {mode === 'digest' 
                                    ? 'Detailed, paper-by-paper narrative synthesizing recent research categories. Best for short time ranges (weeks).' 
                                    : 'High-level synthesis of broad research directions and key breakthroughs over time. Best for long time ranges (months/years).'}
                            </p>
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
        <div className="overview-split-layout">
            {/* Narrative Panel */}
            <div className="overview-narrative-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px', padding: '24px 40px 0 40px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px' }}>
                            Research Overview
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {paperCount} papers · {clusterCount} categories
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn btn-podcast" onClick={handleGeneratePodcast} disabled={podcastLoading} style={{ gap: '6px' }}>
                            {podcastLoading ? <Loader size={16} className="spin-animation" /> : <Mic size={16} />}
                            {podcastLoading ? 'Generating...' : (podcastUrl ? '🎧 Regenerate' : '🎙 Podcast')}
                        </button>
                        <button className="btn" onClick={() => setShowChat(!showChat)} style={{ gap: '6px' }}>
                            <MessageSquare size={16} /> {showChat ? 'Hide Chat' : 'Chat'}
                        </button>
                        <button className="btn" onClick={handleGenerate} style={{ gap: '6px' }}>
                            <RefreshCw size={16} /> Regenerate
                        </button>
                    </div>
                </div>

                {/* Podcast Player */}
                {(podcastUrl || podcastLoading || podcastError) && (
                    <div className="podcast-player glass-panel" style={{ margin: '16px 24px 0 24px' }}>
                        {podcastLoading && (
                            <div className="podcast-loading">
                                <div className="podcast-wave">
                                    <span></span><span></span><span></span><span></span><span></span>
                                </div>
                                <p>{podcastStatus}</p>
                            </div>
                        )}
                        {podcastError && (
                            <div className="podcast-error">
                                <p style={{ color: '#f87171', margin: 0 }}>⚠️ {podcastError}</p>
                            </div>
                        )}
                        {podcastUrl && !podcastLoading && (
                            <div className="podcast-ready">
                                <div className="podcast-icon">
                                    <Volume2 size={24} />
                                </div>
                                <div className="podcast-controls">
                                    <p className="podcast-label">🎧 Research Podcast Ready</p>
                                    <audio
                                        ref={audioRef}
                                        controls
                                        src={podcastUrl}
                                        className="podcast-audio"
                                    />
                                </div>
                                <a
                                    href={podcastUrl}
                                    download
                                    className="btn podcast-download"
                                    title="Download MP3"
                                >
                                    <Download size={16} />
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <div className="overview-body glass-panel" style={{ margin: '16px 24px 24px 24px' }}>
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </div>

                {/* Collapsible Bibliography */}
                {papersList && papersList.length > 0 && (
                    <div className="source-papers-section glass-panel">
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={20} color="var(--primary-color)" /> Analyzed Source Papers ({papersList.length})
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            The following papers were analyzed by the LLM to generate this overview. Click on any paper to open its PDF and chat with the AI assistant.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {Object.entries(
                                papersList.reduce((acc, p) => {
                                    const cat = p.category || 'Uncategorized';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(p);
                                    return acc;
                                }, {})
                            ).map(([catName, catPapers]) => (
                                <details key={catName} className="category-papers-details">
                                    <summary className="category-papers-summary">
                                        <span>
                                            {catName}{' '}
                                            <span style={{ fontWeight: 'normal', color: 'var(--text-tertiary)', fontSize: '0.85rem', marginLeft: '6px' }}>
                                                ({catPapers.length} paper{catPapers.length !== 1 ? 's' : ''})
                                            </span>
                                        </span>
                                        <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', transition: 'transform var(--transition-speed)' }} />
                                    </summary>
                                    <div className="category-papers-content">
                                        {catPapers.map(p => (
                                            <div 
                                                key={p.id} 
                                                className="source-paper-item" 
                                                onClick={() => navigate(`/paper/${p.id}`)}
                                            >
                                                <span className="source-paper-title">{p.title}</span>
                                                <span className="source-paper-meta">
                                                    {p.authors} · {p.date}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Panel */}
            {showChat && (
                <div className="overview-chat-panel">
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.02)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Bot size={20} color="var(--primary-color)" /> Chat with Overview
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Ask questions about the research narrative</p>
                    </div>

                    <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {chatMessages.length === 0 && (
                            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                <Bot size={40} style={{ opacity: 0.5, marginBottom: '16px' }} />
                                <p>I've read the overview. What would you like to know?</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                                    {[
                                        "What are the key trends?",
                                        "Which papers are most impactful?",
                                        "Summarize the ML section",
                                    ].map((suggestion, i) => (
                                        <button
                                            key={i}
                                            className="btn"
                                            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                                            onClick={() => { setChatInput(suggestion); }}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-ai'}`}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                    {msg.role === 'user' ? 'You' : 'Assistant'}
                                </div>
                                {msg.role === 'assistant' ? (
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                ) : (
                                    <div>{msg.content}</div>
                                )}
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="message-bubble message-ai" style={{ opacity: 0.7 }}>
                                <Bot size={12} style={{ marginRight: '4px' }} /> <em>Thinking...</em>
                            </div>
                        )}
                    </div>

                    <div className="chat-input-area">
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Ask about the overview..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                            />
                            <button className="btn btn-primary" onClick={handleChatSend} disabled={chatLoading} style={{ padding: '12px 16px' }}>
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
