// ─── AI Chatbot Utilities ──────────────────────────────────────────────────────
import type { Employee, AttendanceRecord } from '../types';
import { todayKey } from '../utils/helpers';

// ── Admin AI ──────────────────────────────────────────────────────────────────

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
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 400,
                system: `You are an AI assistant for FotoWorld Attendance system. Answer questions about employee attendance concisely and helpfully. Use the provided context. Keep responses short (2-4 sentences max). Be friendly and professional.\n\n${context}`,
                messages: [{ role: 'user', content: userMsg }],
            }),
        });
        const data = await res.json();
        return data.content?.[0]?.text ?? "I couldn't process that. Try asking about present employees or weekly attendance.";
    } catch {
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

// ── Staff AI — salary / attendance calculations ───────────────────────────────

/** Salary config — can be expanded to be fetched from Firestore per employee */
const BASE_DAILY_SALARY = 500;        // ₹ per day
const OVERTIME_HOURLY_RATE = 80;      // ₹ per hour beyond 8h
const STANDARD_HOURS_PER_DAY = 8;

/** Parse "HH:MM AM/PM" or "HH:MM" into a Date-less fractional hour count */
function parseTimeToHours(timeStr: string): number | null {
    if (!timeStr) return null;
    // Handle "HH:MM AM" / "HH:MM PM" formats
    const ampm = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampm) {
        let h = parseInt(ampm[1]);
        const m = parseInt(ampm[2]);
        const period = ampm[3].toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h + m / 60;
    }
    // Handle "HH:MM" 24h format
    const plain = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (plain) return parseInt(plain[1]) + parseInt(plain[2]) / 60;
    return null;
}

interface StaffStats {
    employeeName: string;
    presentDays: number;
    totalWorkingDays: number;
    attendancePercent: number;
    totalHours: number;
    overtimeHours: number;
    baseSalary: number;
    overtimePay: number;
    totalSalary: number;
    weekDays: number;
}

function calcStaffStats(
    myAttendance: AttendanceRecord[],
    employeeName: string,
    periodLabel: 'month' | 'week'
): StaffStats {
    const now = new Date();

    let start: Date;
    let totalWorkingDays: number;

    if (periodLabel === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        // Working days this month (Mon-Fri) up to today
        totalWorkingDays = 0;
        for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0 && d.getDay() !== 6) totalWorkingDays++;
        }
    } else {
        // last 7 days
        start = new Date(now);
        start.setDate(now.getDate() - 6);
        totalWorkingDays = 0;
        for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 0 && d.getDay() !== 6) totalWorkingDays++;
        }
    }

    const periodRecords = myAttendance.filter((r) => {
        const d = new Date(r.date);
        return d >= start && d <= now && r.checkIn;
    });

    let totalHours = 0;
    let overtimeHours = 0;

    for (const rec of periodRecords) {
        if (!rec.checkIn || !rec.checkOut) continue;
        const inH = typeof rec.checkIn === 'string' ? parseTimeToHours(rec.checkIn) : null;
        const outH = typeof rec.checkOut === 'string' ? parseTimeToHours(rec.checkOut) : null;
        if (inH !== null && outH !== null) {
            const worked = outH - inH;
            if (worked > 0) {
                totalHours += worked;
                if (worked > STANDARD_HOURS_PER_DAY) {
                    overtimeHours += worked - STANDARD_HOURS_PER_DAY;
                }
            }
        }
    }

    const presentDays = periodRecords.length;
    const attendancePercent = totalWorkingDays > 0
        ? Math.round((presentDays / totalWorkingDays) * 100)
        : 0;
    const baseSalary = presentDays * BASE_DAILY_SALARY;
    const overtimePay = Math.round(overtimeHours * OVERTIME_HOURLY_RATE);
    const totalSalary = baseSalary + overtimePay;

    return {
        employeeName,
        presentDays,
        totalWorkingDays,
        attendancePercent,
        totalHours: Math.round(totalHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        baseSalary,
        overtimePay,
        totalSalary,
        weekDays: periodLabel === 'week' ? presentDays : 0,
    };
}

export async function queryStaffAI(
    userMsg: string,
    myAttendance: AttendanceRecord[],
    employeeName: string
): Promise<string> {
    const q = userMsg.toLowerCase();
    const isWeekQuery = q.includes('week');
    const isMonthQuery = q.includes('month') || (!isWeekQuery);
    const period: 'month' | 'week' = isWeekQuery ? 'week' : 'month';

    const stats = calcStaffStats(myAttendance, employeeName, period);
    const periodLabel = period === 'week' ? 'this week' : 'this month';
    const now = new Date();
    const monthName = now.toLocaleString('en-IN', { month: 'long' });

    const context = `
Staff Self-Service Context for ${employeeName} (${monthName} ${now.getFullYear()}):
- Present days this month: ${calcStaffStats(myAttendance, employeeName, 'month').presentDays}
- Present days this week: ${calcStaffStats(myAttendance, employeeName, 'week').presentDays}
- Working days this month so far: ${calcStaffStats(myAttendance, employeeName, 'month').totalWorkingDays}
- Working days this week: ${calcStaffStats(myAttendance, employeeName, 'week').totalWorkingDays}
- Total hours worked this month: ${calcStaffStats(myAttendance, employeeName, 'month').totalHours}h
- Overtime hours this month: ${calcStaffStats(myAttendance, employeeName, 'month').overtimeHours}h
- Attendance % this month: ${calcStaffStats(myAttendance, employeeName, 'month').attendancePercent}%
- Base salary this month: ₹${calcStaffStats(myAttendance, employeeName, 'month').baseSalary} (₹${BASE_DAILY_SALARY}/day × days present)
- Overtime pay this month: ₹${calcStaffStats(myAttendance, employeeName, 'month').overtimePay} (₹${OVERTIME_HOURLY_RATE}/extra hour)
- Total estimated salary this month: ₹${calcStaffStats(myAttendance, employeeName, 'month').totalSalary}
`;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 350,
                system: `You are a personal attendance AI assistant for ${employeeName} at FotoWorld. Answer their personal attendance and salary questions in a friendly, human tone. Use the provided context data. Keep responses concise (2-4 sentences). Always use ₹ for currency. Do not share other employees' data.\n\n${context}`,
                messages: [{ role: 'user', content: userMsg }],
            }),
        });
        const data = await res.json();
        return data.content?.[0]?.text ?? offlineFallback(q, stats, periodLabel, monthName);
    } catch {
        return offlineFallback(q, stats, periodLabel, monthName);
    }
}

function offlineFallback(q: string, stats: StaffStats, periodLabel: string, monthName: string): string {
    if (q.includes('salary') && q.includes('overtime')) {
        return `Your total estimated salary ${periodLabel} is ₹${stats.totalSalary} — that's ₹${stats.baseSalary} base pay (${stats.presentDays} days × ₹${BASE_DAILY_SALARY}) plus ₹${stats.overtimePay} overtime for ${stats.overtimeHours}h extra hours.`;
    }
    if (q.includes('salary')) {
        return `Based on ${stats.presentDays} working days in ${monthName}, your estimated base salary is ₹${stats.baseSalary}. Add overtime of ₹${stats.overtimePay} → total ₹${stats.totalSalary}.`;
    }
    if (q.includes('overtime')) {
        return `You've logged ${stats.overtimeHours}h of overtime ${periodLabel}, earning an extra ₹${stats.overtimePay} at ₹${OVERTIME_HOURLY_RATE}/hr.`;
    }
    if (q.includes('percentage') || q.includes('%') || q.includes('percent')) {
        return `Your attendance this month is ${stats.attendancePercent}% — present ${stats.presentDays} out of ${stats.totalWorkingDays} working days.`;
    }
    if (q.includes('week')) {
        return `This week you've been present for ${stats.presentDays} day(s) out of ${stats.totalWorkingDays} working days.`;
    }
    if (q.includes('hour')) {
        return `You've worked ${stats.totalHours}h total ${periodLabel}, including ${stats.overtimeHours}h overtime.`;
    }
    if (q.includes('month') || q.includes('days') || q.includes('work')) {
        return `You've worked ${stats.presentDays} day(s) this month out of ${stats.totalWorkingDays} working days (${stats.attendancePercent}% attendance).`;
    }
    return `Hi ${stats.employeeName}! This month you've worked ${stats.presentDays} days with ${stats.attendancePercent}% attendance. Your estimated salary is ₹${stats.totalSalary}.`;
}
