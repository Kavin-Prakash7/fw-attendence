// ─── Dashboard Page ───────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { todayKey, getInitials } from '../utils/helpers';
import type { Employee, AttendanceRecord, PageState } from '../types';

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
    onNav: (page: PageState) => void;
}

export default function Dashboard({ employees, attendance, onNav }: Props) {
    const today = todayKey();

    const { todayAtt, presentCount, totalHours, recent } = useMemo(() => {
        const todayAtt = attendance.filter((r) => r.date === today);
        const presentCount = todayAtt.filter((r) => r.checkIn).length;
        const totalHours = attendance.reduce((sum, r) => {
            if (!r.checkIn || !r.checkOut) return sum;
            const inT = new Date(`${r.date} ${r.checkIn}`);
            const outT = new Date(`${r.date} ${r.checkOut}`);
            return sum + (outT.getTime() - inT.getTime()) / 3_600_000;
        }, 0);
        const recent = [...attendance]
            .sort((a, b) => {
                const at = a.checkOut || a.checkIn || '';
                const bt = b.checkOut || b.checkIn || '';
                return bt.localeCompare(at);
            })
            .slice(0, 8);
        return { todayAtt, presentCount, totalHours, recent };
    }, [attendance, today]);

    return (
        <div>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{employees.length}</div>
                    <div className="stat-label">TOTAL EMPLOYEES</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon">✅</div>
                    <div className="stat-value">{presentCount}</div>
                    <div className="stat-label">PRESENT TODAY</div>
                    <div className="stat-change">
                        ↑ {employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0}% attendance
                    </div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon">⏱</div>
                    <div className="stat-value">{Math.round(totalHours)}</div>
                    <div className="stat-label">TOTAL HOURS LOGGED</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon">📋</div>
                    <div className="stat-value">{attendance.length}</div>
                    <div className="stat-label">TOTAL RECORDS</div>
                </div>
            </div>

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
                            const emp = employees.find((e) => e.id === r.empId);
                            const isOut = !!r.checkOut;
                            return (
                                <div key={i} className="activity-item">
                                    <div className="activity-avatar">
                                        {emp?.photo ? <img src={emp.photo} alt="" /> : getInitials(emp?.name ?? '?')}
                                    </div>
                                    <div className="activity-info">
                                        <div className="activity-name">{emp?.name ?? r.empId}</div>
                                        <div className="activity-detail">
                                            {isOut ? `Checked out at ${r.checkOut}` : `Checked in at ${r.checkIn}`}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <span className={`activity-badge ${isOut ? 'badge-out' : 'badge-in'}`}>
                                            {isOut ? 'OUT' : 'IN'}
                                        </span>
                                        <div className="activity-time">{r.date}</div>
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
                            const rec = todayAtt.find((r) => r.empId === emp.id);
                            const isIn = !!(rec?.checkIn);
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
                                    <span className={`badge ${isIn ? 'badge-green' : 'badge-red'}`}>{isIn ? 'IN' : 'OUT'}</span>
                                </div>
                            );
                        })}
                        <button className="btn-accent" style={{ width: '100%', marginTop: 16 }} onClick={() => onNav('attendance')}>
                            MANAGE ATTENDANCE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
