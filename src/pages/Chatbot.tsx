// ─── Chatbot Page ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { nowTime } from '../utils/helpers';
import { queryAI } from '../utils/ai';
import type { Employee, AttendanceRecord } from '../types';

interface Message { role: 'bot' | 'user'; text: string; time: string; }

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
}

const SUGGESTIONS = [
    'Who is present today?',
    'Who is absent today?',
    "Show this week's attendance",
    'How many total employees?',
    'What are total hours logged?',
];

export default function Chatbot({ employees, attendance }: Props) {
    const [msgs, setMsgs] = useState<Message[]>([
        {
            role: 'bot',
            text: "Hello! I'm your FotoWorld AI Assistant. Ask me about attendance, who's present, weekly stats, or anything about your team! 📸",
            time: nowTime(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

    async function send(text?: string) {
        const msg = (text ?? input).trim();
        if (!msg) return;
        setInput('');
        setMsgs((m) => [...m, { role: 'user', text: msg, time: nowTime() }]);
        setLoading(true);
        const reply = await queryAI(msg, employees, attendance);
        setMsgs((m) => [...m, { role: 'bot', text: reply, time: nowTime() }]);
        setLoading(false);
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-bot-icon">🤖</div>
                <div>
                    <div className="chat-bot-name">FOTOWORLD AI</div>
                    <div className="chat-bot-status">
                        <span className="chat-status-dot" />Online
                    </div>
                </div>
            </div>

            <div className="chat-messages">
                {msgs.map((m, i) => (
                    <div key={i} className={`chat-msg ${m.role}`}>
                        <div className="chat-bubble">{m.text}</div>
                        <div className="chat-time">{m.time}</div>
                    </div>
                ))}
                {loading && (
                    <div className="chat-msg bot">
                        <div className="chat-bubble">
                            <div className="typing-indicator">
                                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
            </div>

            <div className="chat-input-area">
                <textarea
                    className="chat-input"
                    placeholder="Ask about attendance, employees, hours..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                />
                <button className="chat-send" onClick={() => send()} disabled={loading}>➤</button>
            </div>
        </div>
    );
}
