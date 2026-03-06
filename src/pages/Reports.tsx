// ─── Reports Page ─────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { calcHours } from '../utils/helpers';
import type { Employee, AttendanceRecord } from '../types';

/**
 * Safely convert a checkIn/checkOut value (Timestamp | string | null | unknown)
 * to a human-readable time string.
 */
function toDisplayTime(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof (val as any)?.toDate === 'function') {
        return (val as any).toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (typeof val === 'string') return val || '—';
    return '—';
}

/**
 * Normalise any `date` field to a YYYY-MM-DD string.
 * Handles:
 *   • Firestore Timestamp  → seconds * 1000 → Date → toISOString().split('T')[0]
 *   • Plain "YYYY-MM-DD" string  → returned as-is
 *   • Anything else  → empty string (sorted last)
 */
function toDateStr(val: unknown): string {
    if (!val) return '';
    // Firestore Timestamp  ({ seconds, nanoseconds } or .toDate())
    if (typeof (val as any)?.toDate === 'function') {
        return (val as any).toDate().toISOString().split('T')[0];
    }
    if (typeof (val as any)?.seconds === 'number') {
        return new Date((val as any).seconds * 1000).toISOString().split('T')[0];
    }
    if (typeof val === 'string') return val;
    return '';
}

/**
 * Normalise any `date` field to a display string like "Mar 5, 2026".
 */
function toDisplayDate(val: unknown): string {
    const s = toDateStr(val);
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
}

export default function Reports({ employees, attendance }: Props) {
    const [empFilter, setEmpFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filtered = useMemo(() =>
        attendance
            .filter((r) => {
                if (empFilter !== 'all' && r.empId !== empFilter && (r as any).employeeId !== empFilter) return false;
                // Normalise date to YYYY-MM-DD string before comparing
                const dateStr = toDateStr(r.date);
                if (dateFrom && dateStr && dateStr < dateFrom) return false;
                if (dateTo && dateStr && dateStr > dateTo) return false;
                return true;
            })
            .sort((a, b) => {
                // Sort newest-first. Support Timestamp objects, plain strings, or missing values.
                const toMs = (d: unknown): number => {
                    if (!d) return 0;
                    if (typeof (d as any)?.toDate === 'function') return (d as any).toDate().getTime();
                    if (typeof (d as any)?.seconds === 'number') return (d as any).seconds * 1000;
                    if (typeof d === 'string') return new Date(d).getTime() || 0;
                    return 0;
                };
                return toMs(b.date) - toMs(a.date);
            }),
        [attendance, empFilter, dateFrom, dateTo]
    );

    function exportCSV() {
        const header = ['Date', 'Employee', 'Role', 'Check In', 'Check Out', 'Hours', 'GPS'];
        const rows = filtered.map((r) => {
            const emp = employees.find((e) => e.id === r.empId || e.id === (r as any).employeeId);
            return [
                toDateStr(r.date),          // normalised YYYY-MM-DD
                emp?.name ?? (r as any).employeeName ?? r.empId ?? (r as any).employeeId ?? '',
                emp?.role ?? '',
                toDisplayTime(r.checkIn),   // handles Timestamp or string
                toDisplayTime(r.checkOut),
                calcHours(r),
                r.gps ? `${r.gps.lat},${r.gps.lng}` : '',
            ];
        });
        const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'attendance_report.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    const { monthlyData, maxDays, maxHours } = useMemo(() => {
        const monthMap = new Map<string, { days: number; hours: number }>();
        filtered.forEach(r => {
            const d = toDateStr(r.date);
            if (!d) return;
            const month = d.substring(0, 7); // YYYY-MM
            const current = monthMap.get(month) || { days: 0, hours: 0 };
            current.days++;
            const h = parseFloat(calcHours(r));
            if (!isNaN(h)) current.hours += h;
            monthMap.set(month, current);
        });

        const sortedMonths = Array.from(monthMap.keys()).sort();
        const data = sortedMonths.map(m => {
            const d = monthMap.get(m)!;
            const [year, monthNum] = m.split('-');
            const date = new Date(parseInt(year), parseInt(monthNum) - 1);
            const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            return {
                label,
                days: d.days,
                hours: Math.round(d.hours)
            };
        });

        return {
            monthlyData: data,
            maxDays: Math.max(1, ...data.map(d => d.days)),
            maxHours: Math.max(1, ...data.map(d => d.hours))
        };
    }, [filtered]);

    return (
        <div>
            {monthlyData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
                    <div className="card">
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>MONTHLY ATTENDANCE</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, paddingBottom: 24, paddingRight: 16 }}>
                            {monthlyData.map((d, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${(d.days / maxDays) * 100}%`,
                                        background: 'var(--accent)',
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'height 0.3s ease'
                                    }} title={`${d.days} days`} />
                                    <div style={{ position: 'absolute', bottom: -24, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{d.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>MONTHLY HOURS</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, paddingBottom: 24, paddingRight: 16 }}>
                            {monthlyData.map((d, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${(d.hours / maxHours) * 100}%`,
                                        background: 'var(--blue)',
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'height 0.3s ease'
                                    }} title={`${d.hours} hours`} />
                                    <div style={{ position: 'absolute', bottom: -24, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{d.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="filter-bar">
                <div className="filter-group">
                    <label className="filter-label">EMPLOYEE</label>
                    <select className="filter-select" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
                        <option value="all">All Employees</option>
                        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label className="filter-label">FROM DATE</label>
                    <input className="filter-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                    <label className="filter-label">TO DATE</label>
                    <input className="filter-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <button className="btn-accent" onClick={exportCSV}>⬇ EXPORT CSV</button>
            </div>

            <div style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>
                {filtered.length} RECORDS FOUND
            </div>

            <div className="table-container">
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        No records match your filters.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>DATE</th><th>EMPLOYEE</th><th>ROLE</th>
                                    <th>CHECK IN</th><th>CHECK OUT</th><th>HOURS</th>
                                    <th>SELFIE</th><th>GPS</th><th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => {
                                    // Use pre-resolved name if available (staff records), else look up in employees list
                                    const emp = employees.find((e) => e.id === r.empId || e.id === r.employeeId);
                                    const displayName = r.employeeName ?? emp?.name ?? r.employeeId ?? r.empId;
                                    const hasOut = !!r.checkOut;
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{toDisplayDate(r.date)}</td>
                                            <td><span className="emp-name-cell">{displayName}</span></td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1, color: 'var(--text3)' }}>{emp?.role}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{toDisplayTime(r.checkIn)}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{toDisplayTime(r.checkOut)}</td>
                                            <td style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{calcHours(r)}</td>
                                            <td>
                                                {r.selfie
                                                    ? <img src={r.selfie} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
                                                    : '—'}
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                                                {r.gps ? (
                                                    <a href={`https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>📍 {r.gps.lat}, {r.gps.lng}</a>
                                                ) : (r as any).location ? (
                                                    <a href={`https://www.google.com/maps?q=${(r as any).location.lat},${(r as any).location.lng}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>📍 {(r as any).location.lat}, {(r as any).location.lng}</a>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <span className={`badge ${hasOut ? 'badge-blue' : r.checkIn ? 'badge-green' : 'badge-red'}`}>
                                                    {hasOut ? 'COMPLETE' : r.checkIn ? 'ACTIVE' : 'ABSENT'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
