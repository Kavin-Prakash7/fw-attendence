// ─── Reports Page ─────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { calcHours } from '../utils/helpers';
import type { Employee, AttendanceRecord } from '../types';

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
                if (empFilter !== 'all' && r.empId !== empFilter) return false;
                if (dateFrom && r.date < dateFrom) return false;
                if (dateTo && r.date > dateTo) return false;
                return true;
            })
            .sort((a, b) => b.date.localeCompare(a.date)),
        [attendance, empFilter, dateFrom, dateTo]
    );

    function exportCSV() {
        const header = ['Date', 'Employee', 'Role', 'Check In', 'Check Out', 'Hours', 'GPS'];
        const rows = filtered.map((r) => {
            const emp = employees.find((e) => e.id === r.empId);
            return [
                r.date,
                emp?.name ?? r.empId,
                emp?.role ?? '',
                r.checkIn ?? '',
                r.checkOut ?? '',
                calcHours(r),
                r.gps ? `${r.gps.lat},${r.gps.lng}` : '',
            ];
        });
        const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'attendance_report.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div>
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
                                    const emp = employees.find((e) => e.id === r.empId);
                                    const hasOut = !!r.checkOut;
                                    return (
                                        <tr key={i}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.date}</td>
                                            <td><span className="emp-name-cell">{emp?.name ?? r.empId}</span></td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1, color: 'var(--text3)' }}>{emp?.role}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{r.checkIn ?? '—'}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{r.checkOut ?? '—'}</td>
                                            <td style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{calcHours(r)}</td>
                                            <td>
                                                {r.selfie
                                                    ? <img src={r.selfie} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
                                                    : '—'}
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.gps?.lat ?? '—'}</td>
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
