import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Target, Users, Calendar, FileText, MessageSquare } from 'lucide-react'
import ChatInterface from '../components/ChatInterface'

export default function PaperDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [paper, setPaper] = useState(null)
    const [loading, setLoading] = useState(true)
    const [mobileTab, setMobileTab] = useState('pdf')

    useEffect(() => {
        const fetchPaper = async () => {
            try {
                const res = await axios.get(`/api/papers/${id}`)
                setPaper(res.data)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchPaper()
    }, [id])

    if (loading) return <div style={{ padding: 40 }}><h2>Loading paper...</h2></div>
    if (!paper) return <div style={{ padding: 40 }}><h2>Paper not found.</h2></div>

    const pdfUrl = paper.pdf_url ? paper.pdf_url.replace("http://", "https://") : null;

    return (
        <div className={`details-container ${mobileTab === 'pdf' ? 'show-pdf' : 'show-chat'}`}>
            <div className="pdf-panel">
                <div style={{ padding: '24px', borderBottom: '1px solid var(--surface-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
                    <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: '16px' }}>
                        <ArrowLeft size={16} /> Back to Newsletter
                    </button>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{paper.title}</h1>
                    <div className="card-meta">
                        <span className="tag">
                            <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {new Date(paper.published_date).toLocaleDateString()}
                        </span>
                        <span>
                            <Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {paper.authors.map(a => a.name).join(', ')}
                        </span>
                    </div>
                </div>
                <div style={{ flex: 1, backgroundColor: '#525659', position: 'relative' }}>
                    {pdfUrl ? (
                        <>
                            <div className="mobile-only" style={{ padding: '8px 16px', background: '#333', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#ccc', fontSize: '0.8rem' }}>PDF Preview</span>
                                <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--primary-color)' }}>
                                    Open Full PDF
                                </a>
                            </div>
                            <iframe
                                src={pdfUrl}
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                                title="PDF View"
                            />
                        </>
                    ) : (
                        <div style={{ padding: 40, color: 'white' }}>No PDF available.</div>
                    )}
                </div>
            </div>

            <div className="chat-panel">
                <ChatInterface paperId={paper.id} />
            </div>

            <div className="mobile-tabs">
                <button
                    className={`tab-btn ${mobileTab === 'pdf' ? 'active' : ''}`}
                    onClick={() => setMobileTab('pdf')}
                >
                    <FileText size={20} />
                    <span>PDF</span>
                </button>
                <button
                    className={`tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setMobileTab('chat')}
                >
                    <MessageSquare size={20} />
                    <span>AI Assistant</span>
                </button>
            </div>
        </div>
    )
}
