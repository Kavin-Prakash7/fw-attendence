// ─── Analytics Dashboard ──────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, BarChart2, Users } from 'lucide-react';
import {
    calcSalaries,
    getDailyAttendanceData,
    getWeeklyHoursData,
    getTopEmployeesByHours,
    getMonthlyAttendanceData,
} from '../utils/salary';
import type { Employee, AttendanceRecord } from '../types';

// ─── Brand palette ────────────────────────────────────────────────────────────
const ORANGE = '#ff7a18';
const BLUE = '#1e3a8a';
const TEAL = '#0d9488';
const PURPLE = '#7c3aed';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow)',
            fontFamily: 'var(--font-mono)', fontSize: 12,
        }}>
            <div style={{ color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, marginBottom: 2 }}>
                    <span style={{ opacity: 0.6 }}>{p.name ?? p.dataKey}:</span>
                    <span style={{ fontWeight: 700 }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, delay = 0 }: {
    title: string; subtitle?: string; children: React.ReactNode; delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay }}
            className="activity-card"
            style={{ padding: 24 }}
        >
            <div style={{ marginBottom: 20 }}>
                <div className="section-heading" style={{ marginBottom: 2 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>{subtitle}</div>}
            </div>
            {children}
        </motion.div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Analytics({ employees, attendance }: Props) {
    const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, 1 = last month, …
    const selectedMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - monthOffset);
        return d;
    }, [monthOffset]);

    const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const {
        salaries,
        dailyData,
        weeklyData,
        topData,
        monthlyData,
        totalPayroll,
        avgHours,
    } = useMemo(() => {
        const salaries = calcSalaries(employees, attendance, selectedMonth);
        const dailyData = getDailyAttendanceData(attendance, employees, 7);
        const weeklyData = getWeeklyHoursData(attendance, 4);
        const topData = getTopEmployeesByHours(salaries, 5);
        const monthlyData = getMonthlyAttendanceData(attendance, 6);
        const totalPayroll = salaries.reduce((s, e) => s + e.monthlySalary, 0);
        const avgHours = salaries.length
            ? salaries.reduce((s, e) => s + e.totalHours, 0) / salaries.length
            : 0;
        return { salaries, dailyData, weeklyData, topData, monthlyData, totalPayroll, avgHours };
    }, [employees, attendance, selectedMonth]);

    // Summary stat cards
    const stats = [
        {
            icon: <Users size={22} />, color: BLUE, label: 'TOTAL STAFF',
            value: employees.length,
        },
        {
            icon: <TrendingUp size={22} />, color: ORANGE, label: 'AVG HRS / EMPLOYEE',
            value: avgHours.toFixed(1) + 'h',
        },
        {
            icon: <BarChart2 size={22} />, color: TEAL, label: 'ATTENDANCE DAYS',
            value: salaries.reduce((s, e) => s + e.daysPresent, 0),
        },
        {
            icon: <DollarSign size={22} />, color: PURPLE, label: 'TOTAL PAYROLL',
            value: '₹' + totalPayroll.toLocaleString('en-IN'),
        },
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

            {/* ── Month selector ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 3, color: 'var(--text3)' }}>ANALYTICS</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 2 }}>{monthLabel}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => setMonthOffset(o => o + 1)}>← Prev</button>
                    {monthOffset > 0 && (
                        <button className="btn-accent" style={{ padding: '6px 14px', fontSize: 13 }}
                            onClick={() => setMonthOffset(0)}>This Month</button>
                    )}
                    {monthOffset > 0 && (
                        <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}
                            onClick={() => setMonthOffset(o => Math.max(0, o - 1))}>Next →</button>
                    )}
                </div>
            </div>

            {/* ── Stat cards ── */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {stats.map((s, i) => (
                    <motion.div key={s.label}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="stat-card"
                    >
                        <div style={{ marginBottom: 10, color: s.color }}>{s.icon}</div>
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* ── Row 1: Daily Attendance + Weekly Hours ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

                {/* Chart 1 — Daily Attendance Count */}
                <ChartCard title="Daily Attendance (7 Days)" subtitle="STAFF PRESENT PER DAY" delay={0.1}>
                    <div style={{ height: 230 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={ORANGE} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dy={8} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dx={-4} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="present" name="Present" stroke={ORANGE}
                                    strokeWidth={2.5} fill="url(#gradPresent)" dot={{ r: 3, fill: ORANGE }} />
                                <Area type="monotone" dataKey="absent" name="Absent" stroke={BLUE}
                                    strokeWidth={1.5} fill="url(#gradAbsent)" dot={{ r: 2, fill: BLUE }} strokeDasharray="4 3" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* Chart 2 — Weekly Hours */}
                <ChartCard title="Weekly Working Hours" subtitle="TOTAL HOURS ACROSS ALL STAFF" delay={0.15}>
                    <div style={{ height: 230 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={ORANGE} stopOpacity={0.9} />
                                        <stop offset="100%" stopColor={ORANGE} stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="week" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dy={8} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dx={-4} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="hours" name="Hours" fill="url(#gradHours)" radius={[6, 6, 0, 0]} barSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ── Row 2: Top Employees + Monthly Summary ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>

                {/* Chart 3 — Top employees by hours */}
                <ChartCard title="Top Employees by Hours" subtitle={`${monthLabel.toUpperCase()}`} delay={0.2}>
                    <div style={{ height: 230 }}>
                        {topData.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                No data yet for this period.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradTop" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor={BLUE} stopOpacity={0.9} />
                                            <stop offset="100%" stopColor={ORANGE} stopOpacity={0.9} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: 'var(--text2)', fontFamily: 'var(--font-mono)' }} width={64} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                    <Bar dataKey="hours" name="Hours" fill="url(#gradTop)" radius={[0, 6, 6, 0]} barSize={18} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </ChartCard>

                {/* Chart 4 — Monthly attendance summary */}
                <ChartCard title="Monthly Attendance Summary" subtitle="ATTENDANCE DAYS OVER 6 MONTHS" delay={0.25}>
                    <div style={{ height: 230 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradMonthly" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={TEAL} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dy={8} />
                                <YAxis axisLine={false} tickLine={false}
                                    tick={{ fontSize: 11, fill: 'var(--text3)', fontFamily: 'var(--font-mono)' }} dx={-4} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="days" name="Days" stroke={TEAL}
                                    strokeWidth={2.5} fill="url(#gradMonthly)" dot={{ r: 4, fill: TEAL }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ── Salary Table ── */}
            <ChartCard title="Employee Salary Summary" subtitle={`CALCULATED FOR ${monthLabel.toUpperCase()}`} delay={0.3}>
                {salaries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        No employees found.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['EMPLOYEE', 'ROLE', 'DAYS PRESENT', 'HRS WORKED', 'RATE / DAY', 'MONTHLY SALARY'].map((h) => (
                                        <th key={h} style={{
                                            textAlign: 'left', padding: '8px 12px',
                                            fontFamily: 'var(--font-mono)', fontSize: 10,
                                            letterSpacing: 2, color: 'var(--text3)',
                                            borderBottom: '1px solid var(--border)',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {salaries.map((s, i) => (
                                    <motion.tr
                                        key={s.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.04 }}
                                        style={{ borderBottom: '1px solid var(--border)' }}
                                    >
                                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-display)', fontSize: 14 }}>
                                            <div>{s.name}</div>
                                        </td>
                                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                                            {s.role}
                                        </td>
                                        <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                minWidth: 36,
                                                padding: '3px 10px',
                                                borderRadius: 20,
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                background: s.daysPresent > 0 ? 'rgba(255,122,24,0.12)' : 'rgba(255,255,255,0.04)',
                                                color: s.daysPresent > 0 ? ORANGE : 'var(--text3)',
                                            }}>
                                                {s.daysPresent}d
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text2)' }}>
                                            {s.totalHours}h
                                        </td>
                                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)' }}>
                                            {s.salaryPerDay > 0 ? `₹${s.salaryPerDay.toLocaleString('en-IN')}` : '—'}
                                        </td>
                                        <td style={{ padding: '12px 12px' }}>
                                            <span style={{
                                                fontFamily: 'var(--font-display)',
                                                fontSize: 15,
                                                color: s.monthlySalary > 0 ? '#22c55e' : 'var(--text3)',
                                                fontWeight: 600,
                                            }}>
                                                {s.monthlySalary > 0 ? `₹${s.monthlySalary.toLocaleString('en-IN')}` : '—'}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                            {/* Totals row */}
                            <tfoot>
                                <tr style={{ background: 'var(--surface)' }}>
                                    <td colSpan={4} style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 2, color: 'var(--text3)' }}>
                                        TOTAL PAYROLL
                                    </td>
                                    <td />
                                    <td style={{ padding: '12px 12px' }}>
                                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: ORANGE, fontWeight: 700 }}>
                                            ₹{totalPayroll.toLocaleString('en-IN')}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </ChartCard>
        </motion.div>
    );
}
