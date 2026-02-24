import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, Target } from 'lucide-react'

export default function NewsletterList({ papers, loading }) {
    const navigate = useNavigate()

    if (loading) return <div className="main-content"><h2>Loading papers...</h2></div>

    return (
        <div className="main-content">
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Latest Discoveries
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Your weekly digest of cutting-edge research.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                {papers.map(paper => (
                    <div key={paper.id} className="paper-card glass-panel" onClick={() => navigate(`/paper/${paper.id}`)}>
                        <div className="card-meta" style={{ marginBottom: '4px' }}>
                            <span className="tag">
                                <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                {new Date(paper.published_date).toLocaleDateString()}
                            </span>
                            {paper.categories && paper.categories.slice(0, 2).map((c, idx) => (
                                <span key={idx} className="tag" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', borderColor: 'rgba(236, 72, 153, 0.3)' }}>
                                    <Target size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    {c.name}
                                </span>
                            ))}
                        </div>

                        <h3 className="card-title">{paper.title}</h3>

                        <div className="card-meta" style={{ display: 'flex', alignItems: 'center' }}>
                            <Users size={14} style={{ marginRight: '4px' }} />
                            <span>{paper.authors.slice(0, 3).map(a => a.name).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}</span>
                        </div>

                        <p className="card-abstract">{paper.abstract}</p>
                    </div>
                ))}
                {papers.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No papers found matching your criteria.</p>}
            </div>
        </div>
    )
}
