// ─── AI Chatbot Query ─────────────────────────────────────────────────────────
import type { Employee, AttendanceRecord } from '../types';
import { todayKey } from '../utils/helpers';

export async function queryAI(
    userMsg: string,
    employees: Employee[],
    attendance: AttendanceRecord[]
): Promise<string> {
    const today = todayKey();
    const todayAtt = attendance.filter((r) => r.date === today);

    const presentNames = todayAtt
        .filter((r) => r.checkIn)
        .map((r) => employees.find((e) => e.id === r.empId)?.name ?? r.empId);

    const absentNames = employees
        .filter((e) => !todayAtt.find((r) => r.empId === e.id && r.checkIn))
        .map((e) => e.name);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekAtt = attendance.filter((r) => new Date(r.date) >= weekStart);

    const context = `
Attendance System Context (Today: ${today}):
- Total Employees: ${employees.length}
- Present Today: ${presentNames.length} — ${presentNames.join(', ') || 'None'}
- Absent Today: ${absentNames.join(', ') || 'None'}
- This Week Records: ${weekAtt.length} check-ins across ${[...new Set(weekAtt.map((r) => r.date))].length} days
- Employee List: ${employees.map((e) => `${e.name} (${e.role})`).join(', ')}
`;

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 400,
                system: `You are an AI assistant for FotoWorld Attendance system. Answer questions about employee attendance concisely and helpfully. Use the provided context. Keep responses short (2-4 sentences max). Be friendly and professional.\n\n${context}`,
                messages: [{ role: 'user', content: userMsg }],
            }),
        });
        const data = await res.json();
        return data.content?.[0]?.text ?? "I couldn't process that. Try asking about present employees or weekly attendance.";
    } catch {
        // Graceful offline fallback
        const q = userMsg.toLowerCase();
        if (q.includes('present') || q.includes('today')) {
            if (presentNames.length === 0) return 'No employees have checked in today yet.';
            return `${presentNames.length} employee(s) are present today: ${presentNames.join(', ')}.`;
        }
        if (q.includes('absent')) return `Absent today: ${absentNames.join(', ') || 'Everyone is present!'}.`;
        if (q.includes('week')) return `This week, there have been ${weekAtt.length} check-ins across ${employees.length} employees.`;
        if (q.includes('total') || q.includes('how many')) return `There are ${employees.length} employees in the system.`;
        return `We have ${employees.length} total employees, with ${presentNames.length} present today.`;
    }
}
