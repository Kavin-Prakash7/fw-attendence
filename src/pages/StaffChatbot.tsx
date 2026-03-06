// ─── Staff Personal AI Chatbot ────────────────────────────────────────────────
// Context-aware chatbot answering only the logged-in staff member's own data.
import { useState, useEffect, useRef } from 'react';
import { nowTime } from '../utils/helpers';
import { queryStaffAI } from '../utils/ai';
import type { AttendanceRecord } from '../types';

interface Message { role: 'bot' | 'user'; text: string; time: string; }

interface Props {
    employeeName: string;
    myAttendance: AttendanceRecord[];
}

const STAFF_SUGGESTIONS = [
    'How many days did I work this month?',
    'What is my attendance percentage?',
    'Calculate my salary this month',
    'Include overtime in salary',
    'How many days did I work this week?',
    'How many hours did I work this month?',
];

export default function StaffChatbot({ employeeName, myAttendance }: Props) {
    const [msgs, setMsgs] = useState<Message[]>([
        {
            role: 'bot',
            text: `Hi ${employeeName}! 👋 I'm your personal attendance assistant. Ask me about your working days, attendance %, salary calculations, or overtime this month!`,
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
        const reply = await queryStaffAI(msg, myAttendance, employeeName);
        setMsgs((m) => [...m, { role: 'bot', text: reply, time: nowTime() }]);
        setLoading(false);
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-bot-icon">🤖</div>
                <div>
                    <div className="chat-bot-name">MY AI ASSISTANT</div>
                    <div className="chat-bot-status">
                        <span className="chat-status-dot" />Personal · {employeeName}
                    </div>
                </div>
                <div style={{
                    marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9,
                    background: 'rgba(132,94,247,0.15)', border: '1px solid rgba(132,94,247,0.3)',
                    color: 'var(--accent)', padding: '3px 8px', borderRadius: 4, letterSpacing: 1,
                }}>
                    STAFF MODE
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
                {STAFF_SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
            </div>

            <div className="chat-input-area">
                <textarea
                    className="chat-input"
                    placeholder="Ask about your attendance, salary, hours..."
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
