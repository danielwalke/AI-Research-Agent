import React from 'react'
import { Search } from 'lucide-react'

export default function SidebarFilter({ search, setSearch, category, setCategory, days, setDays, date, setDate }) {
    const categories = [
        { id: '', name: 'All Categories' },
        { id: 'cs.AI', name: 'Artificial Intelligence' },
        { id: 'cs.LG', name: 'Machine Learning' },
        { id: 'stat.ML', name: 'Statistics ML' },
        { id: 'q-bio.QM', name: 'Quantitative Methods' }
    ]

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <h4 style={{ color: 'var(--text-secondary)' }}>Time Range</h4>
                <div style={{ position: 'relative', marginBottom: '4px' }}>
                    <input
                        type="date"
                        className="input-field"
                        value={date || ''}
                        onChange={(e) => {
                            setDate(e.target.value);
                            if (e.target.value) setDays('');
                        }}
                        style={{ width: '100%', colorScheme: 'dark' }}
                    />
                </div>
                <button
                    className={`btn ${days === 7 && !date ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setDays(7); setDate(''); }}
                >
                    Last 7 days
                </button>
                <button
                    className={`btn ${days === 30 && !date ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setDays(30); setDate(''); }}
                >
                    Last 30 days
                </button>
                <button
                    className={`btn ${days === '' && !date ? 'btn-primary' : ''}`}
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setDays(''); setDate(''); }}
                >
                    All Time
                </button>
            </div>
        </div>
    )
}
