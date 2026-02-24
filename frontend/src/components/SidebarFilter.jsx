import React from 'react'
import { Search } from 'lucide-react'

export default function SidebarFilter({ search, setSearch, category, setCategory, startDate, setStartDate, endDate, setEndDate }) {
    const categories = [
        { id: '', name: 'All Categories' },
        { id: 'cs.AI', name: 'Artificial Intelligence' },
        { id: 'cs.LG', name: 'Machine Learning' },
        { id: 'stat.ML', name: 'Statistics ML' },
        { id: 'q-bio.QM', name: 'Quantitative Methods' }
    ]

    const setShortcut = (days) => {
        if (days === '') {
            setStartDate('')
            setEndDate('')
        } else {
            const end = new Date()
            const start = new Date()
            start.setDate(end.getDate() - days)
            setStartDate(start.toISOString().split('T')[0])
            setEndDate('') // Clear end date to mean "up to now" or set to end.toISOString().split('T')[0]
        }
    }

    return (
        <div className="sidebar">
            <h2>Curated ArXiv</h2>

            <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', top: 12, left: 16, color: 'var(--text-tertiary)' }} size={18} />
                <input
                    type="text"
                    placeholder="Search papers..."
                    className="input-field"
                    style={{ paddingLeft: '44px' }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>Categories</h4>
                {categories.map(cat => (
                    <button
                        key={cat.id || 'all'}
                        className={`btn ${category === cat.id ? 'btn-primary' : ''}`}
                        style={{ justifyContent: 'flex-start' }}
                        onClick={() => setCategory(cat.id)}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <h4 style={{ color: 'var(--text-secondary)' }}>Time Range</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Start Date</label>
                    <input
                        type="date"
                        className="input-field"
                        value={startDate || ''}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: '100%', colorScheme: 'dark' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>End Date</label>
                    <input
                        type="date"
                        className="input-field"
                        value={endDate || ''}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ width: '100%', colorScheme: 'dark' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <button
                        className="btn"
                        style={{ fontSize: '0.8rem', padding: '8px' }}
                        onClick={() => setShortcut(7)}
                    >
                        Last 7d
                    </button>
                    <button
                        className="btn"
                        style={{ fontSize: '0.8rem', padding: '8px' }}
                        onClick={() => setShortcut(30)}
                    >
                        Last 30d
                    </button>
                    <button
                        className="btn"
                        style={{ fontSize: '0.8rem', padding: '8px', gridColumn: 'span 2' }}
                        onClick={() => setShortcut('')}
                    >
                        All Time
                    </button>
                </div>
            </div>
        </div>
    )
}
