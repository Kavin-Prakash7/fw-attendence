// ─── Dashboard Page ───────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import { todayKey, getInitials, calcHours } from '../utils/helpers';
import type { Employee, AttendanceRecord, PageState } from '../types';

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
    onNav: (page: PageState) => void;
}

// ── Module-level helpers ───────────────────────────────────────────────────────
// Defined OUTSIDE the component so they are never recreated on each render or
// inside .map() callbacks — which would cause React to see new function objects
// every cycle and is the pattern that risks Timestamp objects leaking into JSX.

/**
 * Convert any checkIn / checkOut value to a displayable time string.
 * Handles:
 *   • Firestore Timestamp  → .toDate().toLocaleTimeString()
 *   • Plain string         → returned as-is
 *   • null / undefined     → "—"
 * Never returns an object, so React will never throw
 * "Objects are not valid as a React child".
 */
function fmtTime(val: unknown): string {
    if (val === null || val === undefined) return '—';
    // Firestore Timestamp: has both .toDate() and .toMillis()
    if (typeof (val as any)?.toDate === 'function') {
        return (val as any).toDate().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit',
        });
    }
    // Plain string (legacy format e.g. "09:30 AM")
    if (typeof val === 'string') return val;
    // Anything else (number, unexpected object) — convert safely
    return String(val);
}

/**
 * Convert a date field to a displayable string.
 * Guards against the rare case where `date` is a Timestamp object.
 */
function fmtDate(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof (val as any)?.toDate === 'function') {
        return (val as any).toDate().toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    }
    return String(val);
}

export default function Dashboard({ employees, attendance, onNav }: Props) {
    const today = todayKey();

    const { todayAtt, presentCount, totalHours, recent, chartData } = useMemo(() => {

        // ── Defensive guard — bail out early if there is nothing to process ────
        if (!attendance || attendance.length === 0) {
            return { todayAtt: [], presentCount: 0, totalHours: 0, recent: [], chartData: [] };
        }

        const todayAtt = attendance.filter((r) => r?.date === today);
        const presentCount = todayAtt.filter((r) => r?.checkIn).length;

        // ── Helper: convert a checkIn/checkOut value to milliseconds ──────────
        // Handles three possible types safely:
        //   1. Firestore Timestamp object  → .toMillis()
        //   2. Plain date string "YYYY-MM-DD HH:MM" or time string "HH:MM AM"
        //   3. null / undefined            → 0 (safe fallback)
        function toMs(date: string | undefined, timeVal: string | unknown | null): number {
            if (!timeVal || !date) return 0;
            // Firestore Timestamp object
            if (typeof (timeVal as any)?.toMillis === 'function') {
                return (timeVal as any).toMillis();
            }
            // Legacy string: combine date + time string → Date
            if (typeof timeVal === 'string' && timeVal.length > 0) {
                const d = new Date(`${date} ${timeVal}`);
                return isNaN(d.getTime()) ? 0 : d.getTime();
            }
            return 0;
        }

        const totalHours = attendance.reduce((sum, r) => {
            if (!r?.checkIn || !r?.checkOut) return sum;
            const inMs = toMs(r.date, r.checkIn);
            const outMs = toMs(r.date, r.checkOut);
            if (!inMs || !outMs || outMs <= inMs) return sum;
            return sum + (outMs - inMs) / 3_600_000;
        }, 0);

        // ── Sort by most recent activity ──────────────────────────────────────
        // Guard: only sort when data exists (avoids running on empty arrays).
        // Uses toMs() so Timestamp objects and strings are both handled safely —
        // no .localeCompare() call on a non-string value.
        if (!attendance || attendance.length === 0) {
            return { todayAtt, presentCount, totalHours, recent: [] };
        }

        const recent = [...attendance]
            .sort((a, b) => {
                const aMs = toMs(a?.date, a?.checkOut || a?.checkIn);
                const bMs = toMs(b?.date, b?.checkOut || b?.checkIn);
                return bMs - aMs;              // descending: newest first
            })
            .slice(0, 8);

        // ── Compute 7-day chart data ────────
        const chartData = [];
        const todayObj = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayObj);
            d.setDate(d.getDate() - i);
            const dKey = d.toISOString().split('T')[0];
            const dAtt = attendance.filter(r => r?.date === dKey);

            const present = dAtt.filter(r => r?.checkIn).length;
            const hours = dAtt.reduce((s, r) => {
                const inMs = toMs(r.date, r.checkIn);
                const outMs = toMs(r.date, r.checkOut);
                if (!inMs || !outMs || outMs <= inMs) return s;
                return s + (outMs - inMs) / 3_600_000;
            }, 0);

            chartData.push({
                date: d.toLocaleDateString('en-US', { weekday: 'short' }),
                hours: Math.round(hours * 10) / 10,
                present
            });
        }

        return { todayAtt, presentCount, totalHours, recent, chartData };
    }, [attendance, today]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="stats-grid">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="stat-card">
                    <div style={{ marginBottom: 12, color: '#1E3A8A' }}><Users size={28} /></div>
                    <div className="stat-value">{employees.length}</div>
                    <div className="stat-label">TOTAL EMPLOYEES</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="stat-card green">
                    <div style={{ marginBottom: 12, color: '#22c55e' }}><CheckCircle size={28} /></div>
                    <div className="stat-value">{presentCount}</div>
                    <div className="stat-label">PRESENT TODAY</div>
                    <div className="stat-change">
                        ↑ {employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0}% attendance
                    </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="stat-card blue">
                    <div style={{ marginBottom: 12, color: '#3b82f6' }}><Clock size={28} /></div>
                    <div className="stat-value">{Math.round(totalHours)}</div>
                    <div className="stat-label">TOTAL HOURS LOGGED</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }} className="stat-card purple">
                    <div style={{ marginBottom: 12, color: '#ef4444' }}><XCircle size={28} /></div>
                    <div className="stat-value">{employees.length - presentCount}</div>
                    <div className="stat-label">ABSENT TODAY</div>
                </motion.div>
            </div>

            {chartData && chartData.length > 0 && (
                <div className="dashboard-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="activity-card" style={{ padding: 24 }}>
                        <div className="section-heading" style={{ marginBottom: 16 }}>Weekly Attendance Hours</div>
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dx={-10} />
                                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow)' }} />
                                    <Area type="monotone" dataKey="hours" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="activity-card" style={{ padding: 24 }}>
                        <div className="section-heading" style={{ marginBottom: 16 }}>Employee Attendance Trend</div>
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dx={-10} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow)' }} />
                                    <Bar dataKey="present" fill="#1E3A8A" radius={[6, 6, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>
            )}

            <div className="dashboard-grid">
                {/* Recent Activity */}
                <div className="activity-card">
                    <div className="section-header">
                        <div className="section-heading">RECENT ACTIVITY</div>
                        <button className="view-all" onClick={() => onNav('reports')}>VIEW ALL</button>
                    </div>
                    {recent.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            No activity yet. Start by checking in employees.
                        </div>
                    ) : (
                        recent.map((r, i) => {
                            // Support both record shapes:
                            //   NEW: { employeeId (= Auth UID), employeeName (resolved), checkIn (Timestamp), checkOut (Timestamp) }
                            //   OLD: { empId, checkIn (string), checkOut (string) }
                            const lookupId = r.employeeId ?? r.empId;
                            const emp: Employee | undefined =
                                employees.find((e) => e.id === lookupId) ??
                                employees.find((e) => e.id === r.empId);

                            // Prefer the pre-resolved name (set by useFirebaseData enrichment)
                            const displayName = r.employeeName ?? emp?.name ?? lookupId ?? '—';

                            const isOut = !!r.checkOut;
                            const hoursStr = calcHours(r);  // handles Timestamps & strings

                            return (
                                <div key={i} className="activity-item">
                                    <div className="activity-avatar">
                                        {emp?.photo
                                            ? <img src={emp.photo} alt="" />
                                            : getInitials(displayName)
                                        }
                                    </div>

                                    {/* Employee name + activity detail */}
                                    <div className="activity-info" style={{ flex: 1 }}>
                                        <div className="activity-name">
                                            {displayName}
                                        </div>
                                        <div className="activity-detail">
                                            {isOut
                                                ? `Checked out at ${fmtTime(r.checkOut)}`
                                                : `Checked in at ${fmtTime(r.checkIn)}`
                                            }
                                        </div>
                                    </div>

                                    {/* Hours worked + status badge + date */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <span className={`activity-badge ${isOut ? 'badge-out' : 'badge-in'}`}>
                                            {isOut ? 'OUT' : 'IN'}
                                        </span>
                                        {hoursStr !== '—' && (
                                            <div style={{
                                                fontFamily: 'var(--font-mono)', fontSize: 10,
                                                color: 'var(--accent)', letterSpacing: 1,
                                            }}>
                                                ⏱ {hoursStr}
                                            </div>
                                        )}
                                        <div className="activity-time">{fmtDate(r.date)}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Today's Status */}
                <div>
                    <div className="activity-card">
                        <div className="section-header">
                            <div className="section-heading">TODAY'S STATUS</div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{today}</span>
                        </div>
                        {employees.map((emp) => {
                            // Match on empId (legacy) OR employeeId (staff records)
                            const rec = todayAtt.find((r) => r.empId === emp.id || r.employeeId === emp.id);
                            const isIn = !!(rec?.checkIn);
                            const loc = (rec as any)?.location;
                            const hasLoc = loc && (typeof loc.lat === 'number' || typeof loc.lat === 'string');
                            return (
                                <div key={emp.id} className="activity-item">
                                    <div className="activity-avatar">
                                        {emp.photo ? <img src={emp.photo} alt="" /> : getInitials(emp.name)}
                                    </div>
                                    <div className="activity-info">
                                        <div className="activity-name">{emp.name}</div>
                                        <div className="activity-detail" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1 }}>
                                            {emp.role}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <span className={`badge ${isIn ? 'badge-green' : 'badge-red'}`}>{isIn ? 'IN' : 'OUT'}</span>
                                        {hasLoc && (
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}&zoom=16`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}
                                                title={`Lat: ${loc.lat}, Lng: ${loc.lng}`}
                                            >
                                                📍 GPS
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <button className="btn-accent" style={{ width: '100%', marginTop: 16 }} onClick={() => onNav('attendance')}>
                            MANAGE ATTENDANCE
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
