import React from 'react'
import { Search } from 'lucide-react'

export default function SidebarFilter({ search, setSearch, category, setCategory }) {
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
        </div>
    )
}
