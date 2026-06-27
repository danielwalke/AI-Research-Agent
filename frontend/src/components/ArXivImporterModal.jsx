import React, { useState, useEffect, useRef } from 'react'
import { X, Download, Terminal, Calendar, Sliders, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ArXivImporterModal({ isOpen, onClose, onImportSuccess }) {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
    const [categoryMode, setCategoryMode] = useState('all') // 'all', 'configured', 'custom'
    const [customCategory, setCustomCategory] = useState('')
    const [maxResults, setMaxResults] = useState(100)
    const [isImporting, setIsImporting] = useState(false)
    const [logs, setLogs] = useState([])
    const [status, setStatus] = useState('idle') // 'idle', 'importing', 'success', 'error'
    const [importSummary, setImportSummary] = useState(null)
    const logContainerRef = useRef(null)

    // Scroll logs to bottom when they change
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [logs])

    if (!isOpen) return null

    const handlePreset = (days) => {
        const today = new Date().toISOString().split('T')[0]
        const start = new Date()
        start.setDate(start.getDate() - days)
        setStartDate(start.toISOString().split('T')[0])
        setEndDate(today)
    }

    const startImport = async () => {
        if (!startDate) {
            setLogs(['Error: Start Date is required.'])
            setStatus('error')
            return
        }

        setIsImporting(true)
        setStatus('importing')
        setLogs([`[${new Date().toLocaleTimeString()}] Initializing connection to ArXiv API...`])
        setImportSummary(null)

        try {
            // Determine category parameter based on mode
            let targetCategory = null
            if (categoryMode === 'all') {
                targetCategory = '*'
            } else if (categoryMode === 'custom') {
                if (!customCategory.trim()) {
                    throw new Error('Please specify a custom category code (e.g. cs.CV, math.PR).')
                }
                targetCategory = customCategory.trim()
            }

            const body = {
                start_date: startDate,
                end_date: endDate || new Date().toISOString().split('T')[0],
                category: targetCategory,
                max_results: maxResults
            }

            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetch parameters:`, `  - Start Date: ${body.start_date}`, `  - End Date: ${body.end_date}`, `  - Category Constraint: ${body.category || 'Configured Defaults'}`, `  - Max Results: ${body.max_results}`, `[${new Date().toLocaleTimeString()}] Dispatching request to server...`])

            const response = await fetch('/api/papers/fetch-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                let errDetail = 'HTTP request failed.'
                try {
                    const errData = await response.json()
                    errDetail = errData.detail || errDetail
                } catch (e) {}
                throw new Error(errDetail)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n\n')
                buffer = parts.pop() || ''

                for (const part of parts) {
                    const line = part.trim()
                    if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim()
                        if (!dataStr) continue

                        const data = JSON.parse(dataStr)
                        if (data.status === 'processing') {
                            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.message}`])
                        } else if (data.status === 'complete') {
                            const newCount = data.new_papers
                            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Success: Import complete!`, `[${new Date().toLocaleTimeString()}] Total new papers stored: ${newCount}`])
                            setImportSummary({ count: newCount })
                            setStatus('success')
                            setIsImporting(false)
                            if (onImportSuccess) {
                                onImportSuccess(newCount)
                            }
                        } else if (data.status === 'error') {
                            throw new Error(data.detail || 'The server encountered an error during import.')
                        }
                    }
                }
            }
        } catch (err) {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`])
            setStatus('error')
            setIsImporting(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(5, 4, 10, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '650px',
                background: 'rgba(18, 14, 28, 0.95)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.15)',
                overflow: 'hidden',
                animation: 'fadeIn 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.2)'
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', color: '#f8fafc' }}>
                        <Download size={20} style={{ color: '#a78bfa' }} /> ArXiv Importer
                    </h3>
                    <button 
                        onClick={onClose} 
                        disabled={isImporting}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: '70vh' }}>
                    
                    {status !== 'importing' && status !== 'success' && status !== 'error' && (
                        <>
                            {/* Date range picker */}
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> Time Window
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Start Date</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            style={{ colorScheme: 'dark' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>End Date (Inclusive)</label>
                                        <input
                                            type="date"
                                            className="input-field"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            style={{ colorScheme: 'dark' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handlePreset(1)}>Yesterday</button>
                                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handlePreset(3)}>Last 3 Days</button>
                                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handlePreset(7)}>Last 7 Days</button>
                                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handlePreset(14)}>Last 14 Days</button>
                                </div>
                            </div>

                            {/* Category mode */}
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sliders size={14} /> Category Configuration
                                </h4>
                                
                                <div style={{
                                    display: 'flex',
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '8px',
                                    padding: '4px',
                                    gap: '4px',
                                    marginBottom: '12px'
                                }}>
                                    <button 
                                        type="button"
                                        className={`btn ${categoryMode === 'all' ? 'btn-primary' : ''}`}
                                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                                        onClick={() => setCategoryMode('all')}
                                    >
                                        All arXiv Categories
                                    </button>
                                    <button 
                                        type="button"
                                        className={`btn ${categoryMode === 'configured' ? 'btn-primary' : ''}`}
                                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                                        onClick={() => setCategoryMode('configured')}
                                    >
                                        Configured Defaults
                                    </button>
                                    <button 
                                        type="button"
                                        className={`btn ${categoryMode === 'custom' ? 'btn-primary' : ''}`}
                                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                                        onClick={() => setCategoryMode('custom')}
                                    >
                                        Custom Category
                                    </button>
                                </div>

                                {categoryMode === 'all' && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '4px 0 0 4px' }}>
                                        ⚠️ This will fetch all kinds of papers published on arXiv without any category constraint.
                                    </p>
                                )}

                                {categoryMode === 'configured' && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '4px 0 0 4px' }}>
                                        Fetches papers from the default configured categories in the app (e.g. computer science, machine learning, quantitative biology).
                                    </p>
                                )}

                                {categoryMode === 'custom' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Category Code</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g. cs.CV, math.PR, physics.optics, quant-ph"
                                            value={customCategory}
                                            onChange={(e) => setCustomCategory(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Max results slider */}
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Sliders Max Papers to Import per Category / Query ({maxResults})
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <input
                                        type="range"
                                        min="20"
                                        max="500"
                                        step="20"
                                        value={maxResults}
                                        onChange={(e) => setMaxResults(Number(e.target.value))}
                                        style={{ flex: 1, accentColor: 'var(--primary-color)' }}
                                    />
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={maxResults}
                                        onChange={(e) => setMaxResults(Math.min(1000, Math.max(1, Number(e.target.value))))}
                                        style={{ width: '80px', padding: '8px 12px' }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Progress details & Log Terminal */}
                    {(status === 'importing' || status === 'success' || status === 'error') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                background: status === 'success' ? 'rgba(16, 185, 129, 0.1)' : status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                border: `1px solid ${status === 'success' ? 'rgba(16, 185, 129, 0.3)' : status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                                borderRadius: '8px'
                            }}>
                                {status === 'importing' && (
                                    <Download size={24} className="spin-animation" style={{ color: '#a78bfa' }} />
                                )}
                                {status === 'success' && (
                                    <CheckCircle size={24} style={{ color: '#10b981' }} />
                                )}
                                {status === 'error' && (
                                    <AlertTriangle size={24} style={{ color: '#ef4444' }} />
                                )}
                                <div>
                                    <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '0.95rem' }}>
                                        {status === 'importing' && 'Importing ArXiv Papers...'}
                                        {status === 'success' && 'Import Completed successfully!'}
                                        {status === 'error' && 'Import Failed'}
                                    </h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {status === 'importing' && 'Fetching files and extracting abstract metadata...'}
                                        {status === 'success' && `Successfully added ${importSummary?.count} new papers to the database.`}
                                        {status === 'error' && 'Please check the log details below.'}
                                    </p>
                                </div>
                            </div>

                            {/* Console screen */}
                            <div>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Terminal size={14} /> Console Output
                                </h4>
                                <div 
                                    ref={logContainerRef}
                                    style={{
                                        background: 'rgba(5, 5, 8, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        height: '240px',
                                        overflowY: 'auto',
                                        fontFamily: 'Consolas, Monaco, monospace',
                                        fontSize: '0.8rem',
                                        color: '#34d399',
                                        whiteSpace: 'pre-wrap',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        scrollBehavior: 'smooth'
                                    }}
                                >
                                    {logs.map((log, idx) => (
                                        <div key={idx} style={{ 
                                            color: log.includes('ERROR') ? '#f87171' : log.includes('Success') ? '#34d399' : log.includes('Initialize') || log.includes('Dispatching') ? '#a78bfa' : '#94a3b8',
                                            lineHeight: '1.4'
                                        }}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    gap: '12px'
                }}>
                    {status !== 'importing' ? (
                        <>
                            <button 
                                className="btn" 
                                onClick={onClose}
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                            >
                                {status === 'success' ? 'Done' : 'Cancel'}
                            </button>
                            {status !== 'success' && (
                                <button 
                                    className="btn btn-primary"
                                    onClick={startImport}
                                    style={{ gap: '8px' }}
                                >
                                    <Download size={16} /> Start Import
                                </button>
                            )}
                        </>
                    ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                            Please do not close this window while import is in progress...
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
