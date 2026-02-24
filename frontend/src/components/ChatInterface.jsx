import React, { useState } from 'react'
import axios from 'axios'
import { Send, Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function ChatInterface({ paperId }) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const newMsg = { role: 'user', content: input }
        const updatedMessages = [...messages, newMsg]
        setMessages(updatedMessages)
        setInput('')
        setLoading(true)

        try {
            const res = await axios.post('/api/chat/', {
                paper_id: paperId,
                messages: updatedMessages,
                model: "openrouter/auto"
            })

            setMessages([...updatedMessages, { role: 'assistant', content: res.data.reply }])
        } catch (err) {
            console.error(err)
            setMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, I encountered an error.' }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.02)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Bot size={20} color="var(--primary-color)" /> AI Research Assistant
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Ask me anything about this paper</p>
            </div>

            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Bot size={40} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <p>I have read the paper. What would you like to know?</p>
                    </div>
                )}
                {messages.map((msg, idx) => (
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
                {loading && (
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
                        placeholder="Ask a question..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button className="btn btn-primary" onClick={handleSend} disabled={loading} style={{ padding: '12px 16px' }}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
