import React, { useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { BookOpen, Loader, Sparkles, RefreshCw, Send, Bot, User, MessageSquare } from 'lucide-react'

export default function ResearchOverview({ startDate, endDate, search, category }) {
    const [markdown, setMarkdown] = useState('')
    const [paperCount, setPaperCount] = useState(0)
    const [clusterCount, setClusterCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Chat state
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [showChat, setShowChat] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        setError('')
        setChatMessages([])
        try {
            const body = { start_date: startDate }
            if (endDate) body.end_date = endDate
            if (search) body.search = search
            if (category) body.category = category

            const res = await axios.post('/api/overview/generate', body)
            setMarkdown(res.data.markdown)
            setPaperCount(res.data.paper_count)
            setClusterCount(res.data.cluster_count)
            setShowChat(true)
        } catch (err) {
            console.error(err)
            setError(err.response?.data?.detail || 'Failed to generate overview. Please try again.')
        } finally {
            setLoading(false)
        }
    }

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

    // Build filter description for CTA
    const filterDesc = []
    if (startDate) filterDesc.push(startDate)
    if (endDate) filterDesc.push(`to ${endDate}`)
    if (category) filterDesc.push(category)
    if (search) filterDesc.push(`"${search}"`)

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
                            AI will analyze the papers matching your current filters and write a coherent narrative overview. You can then chat with the overview to explore insights.
                        </p>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '24px' }}>
                            {filterDesc.map((f, i) => (
                                <span key={i} className="tag">{f}</span>
                            ))}
                            {filterDesc.length === 0 && <span className="tag">All papers</span>}
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" onClick={() => setShowChat(!showChat)} style={{ gap: '6px' }}>
                            <MessageSquare size={16} /> {showChat ? 'Hide Chat' : 'Chat'}
                        </button>
                        <button className="btn" onClick={handleGenerate} style={{ gap: '6px' }}>
                            <RefreshCw size={16} /> Regenerate
                        </button>
                    </div>
                </div>

                <div className="overview-body glass-panel" style={{ margin: '16px 24px 24px 24px' }}>
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </div>
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
