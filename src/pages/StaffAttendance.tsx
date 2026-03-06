// ─── Staff Personal Attendance Page ───────────────────────────────────────────
// Check-in / Check-out using Firebase Auth UID directly as employeeId.
// Stores records in: attendance/{uid}_{date}
// Fields: employeeId (= uid), checkIn (Timestamp), checkOut (Timestamp),
//         date (YYYY-MM-DD), totalHours (decimal)
//
// Does NOT require a matching employee document in Firestore.
// Works as long as the user is authenticated (auth.uid is used).

import { useState, useEffect } from 'react';
import { todayKey, formatDate } from '../utils/helpers';
import {
    staffCheckIn,
    staffCheckOut,
    subscribeStaffAttendance,
} from '../firebase/services';
import { isFirebaseConfigured } from '../hooks/useFirebaseData';
import type { StaffAttendanceRecord } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    /** Firebase Auth UID — used directly as employeeId in Firestore */
    uid: string;
    /** Display name shown in the header */
    userName: string;
    /** Optional avatar initial override (falls back to first char of userName) */
    userPhoto?: string;
    /** Toast notification handler */
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp (or null) to a human-readable time string */
function tsToTime(ts: unknown | null): string {
    if (!ts) return '—';
    if (typeof (ts as any).toDate === 'function') {
        return (ts as any).toDate().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }
    // Fallback for plain string timestamps (legacy)
    if (typeof ts === 'string' && ts.length > 0) return ts;
    return '—';
}

/** Format totalHours number as "Xh Ym" */
function fmtHours(h: number | null): string {
    if (h === null || h === undefined) return '—';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StaffAttendance({ uid, userName, userPhoto, showToast }: Props) {
    const configured = isFirebaseConfigured();
    const today = todayKey();

    const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
    const [busy, setBusy] = useState<'in' | 'out' | null>(null);
    const [capturedLocation, setCapturedLocation] = useState<{ lat: number; lng: number } | null>(null);

    // ── Subscribe to this staff member's attendance (real-time) ─────────────────
    useEffect(() => {
        if (!configured || !uid) return;
        console.log('[StaffAttendance] Subscribing for uid:', uid);
        const unsub = subscribeStaffAttendance(uid, (recs) => {
            setRecords(recs);
            console.log('[StaffAttendance] Records updated:', recs.length);
        });
        return unsub;
    }, [configured, uid]);

    // ── Today's record derived from real-time subscription ──────────────────────
    const todayRec = records.find((r) => r.date === today) ?? null;
    const hasCheckedIn = !!todayRec?.checkIn;
    const hasCheckedOut = !!todayRec?.checkOut;

    // ── Check In ────────────────────────────────────────────────────────────────
    async function handleCheckIn() {
        if (!configured) {
            showToast('Firebase not configured. Live check-in unavailable.', 'error');
            return;
        }
        if (hasCheckedIn) {
            showToast('Already checked in today.', 'error');
            return;
        }
        setBusy('in');

        if (!navigator.geolocation) {
            showToast('Location permission is required to check in.', 'error');
            setBusy(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                try {
                    await staffCheckIn(uid, today, location);
                    setCapturedLocation(location);
                    showToast('✅ Checked in successfully!');
                } catch (err: any) {
                    console.error('[StaffAttendance] Check-in error:', err);
                    showToast(err?.message ?? 'Check-in failed. Please try again.', 'error');
                } finally {
                    setBusy(null);
                }
            },
            (error) => {
                console.error('[StaffAttendance] Geolocation error:', error);
                showToast('Location required for attendance verification.', 'error');
                setBusy(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    // ── Check Out ───────────────────────────────────────────────────────────────
    async function handleCheckOut() {
        if (!configured) {
            showToast('Firebase not configured. Live check-out unavailable.', 'error');
            return;
        }
        if (!hasCheckedIn) {
            showToast('You have not checked in yet today.', 'error');
            return;
        }
        if (hasCheckedOut) {
            showToast('Already checked out today.', 'error');
            return;
        }
        setBusy('out');
        try {
            await staffCheckOut(uid, today);
            showToast('🏁 Checked out successfully!');
        } catch (err: any) {
            console.error('[StaffAttendance] Check-out error:', err);
            showToast(err?.message ?? 'Check-out failed. Please try again.', 'error');
        } finally {
            setBusy(null);
        }
    }

    // ── Stats ───────────────────────────────────────────────────────────────────
    const now = new Date();

    const monthRecords = records.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekRecords = records.filter((r) => new Date(r.date) >= weekStart);

    const totalHoursThisMonth = monthRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);

    // ── Status badge ────────────────────────────────────────────────────────────
    const statusBadge = hasCheckedOut
        ? { text: 'DONE', cls: 'badge-blue' }
        : hasCheckedIn
            ? { text: 'CHECKED IN', cls: 'badge-green' }
            : { text: 'NOT IN', cls: 'badge-red' };

    // ── Avatar initial ────────────────────────────────────────────────────────
    const initial = (userName || 'S')[0].toUpperCase();

    return (
        <div style={{ maxWidth: 700, margin: '0 auto' }}>

            {/* ── TODAY'S STATUS CARD ──────────────────────────────────────────── */}
            <div className="card" style={{ marginBottom: 24 }}>

                {/* Employee header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div
                        className="activity-avatar"
                        style={{ width: 54, height: 54, fontSize: 20, flexShrink: 0 }}
                    >
                        {userPhoto
                            ? <img src={userPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : initial
                        }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {userName}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: 2, marginTop: 2 }}>
                            STAFF MEMBER
                        </div>
                    </div>
                    <span className={`badge ${statusBadge.cls}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        {statusBadge.text}
                    </span>
                </div>

                {/* Date label */}
                <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--text3)', letterSpacing: 2, marginBottom: 20,
                }}>
                    TODAY — {formatDate(today)}
                </div>

                {/* ── Time display ── */}
                <div className="att-times" style={{ marginBottom: 24 }}>
                    <div className="att-time-block">
                        <div className="att-time-label">CHECK IN</div>
                        <div className={`att-time-value ${!hasCheckedIn ? 'na' : ''}`}>
                            {tsToTime(todayRec?.checkIn ?? null)}
                        </div>
                    </div>
                    <div className="att-time-block">
                        <div className="att-time-label">CHECK OUT</div>
                        <div className={`att-time-value ${!hasCheckedOut ? 'na' : ''}`}>
                            {tsToTime(todayRec?.checkOut ?? null)}
                        </div>
                    </div>
                    <div className="att-time-block">
                        <div className="att-time-label">TOTAL HOURS</div>
                        <div className="att-time-value">
                            {fmtHours(todayRec?.totalHours ?? null)}
                        </div>
                    </div>
                </div>

                {/* ── Action Buttons ── */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {/* CHECK IN */}
                    <button
                        id="staff-check-in-btn"
                        className="att-btn-in"
                        style={{
                            flex: 1,
                            opacity: hasCheckedIn ? 0.4 : 1,
                            cursor: hasCheckedIn ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleCheckIn}
                        disabled={!!busy || hasCheckedIn}
                        title={hasCheckedIn ? 'Already checked in today' : 'Check in now'}
                    >
                        {busy === 'in'
                            ? <span className="spinner" />
                            : '✅ CHECK IN'
                        }
                    </button>

                    {/* CHECK OUT */}
                    <button
                        id="staff-check-out-btn"
                        className="att-btn-out"
                        style={{
                            flex: 1,
                            opacity: (!hasCheckedIn || hasCheckedOut) ? 0.4 : 1,
                            cursor: (!hasCheckedIn || hasCheckedOut) ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleCheckOut}
                        disabled={!!busy || !hasCheckedIn || hasCheckedOut}
                        title={
                            !hasCheckedIn ? 'Check in first'
                                : hasCheckedOut ? 'Already checked out today'
                                    : 'Check out now'
                        }
                    >
                        {busy === 'out'
                            ? <span className="spinner" />
                            : '🏁 CHECK OUT'
                        }
                    </button>
                </div>

                {/* All-done message */}
                {hasCheckedOut && (
                    <div className="att-done-msg" style={{ marginTop: 14 }}>
                        ✓ ALL DONE FOR TODAY — {fmtHours(todayRec?.totalHours ?? null)} worked
                    </div>
                )}

                {/* ── GPS Location Preview ─────────────────────────────────── */}
                {(capturedLocation || (todayRec as any)?.location) && (() => {
                    const loc = capturedLocation ?? (todayRec as any)?.location;
                    const lat = typeof loc?.lat === 'number' ? loc.lat : parseFloat(loc?.lat);
                    const lng = typeof loc?.lng === 'number' ? loc.lng : parseFloat(loc?.lng);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;
                    return (
                        <div style={{
                            marginTop: 16, borderRadius: 12, overflow: 'hidden',
                            border: '1px solid var(--border)',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px',
                                background: 'var(--surface)',
                                borderBottom: '1px solid var(--border)',
                            }}>
                                <span style={{ fontSize: 16 }}>📍</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>CHECK-IN LOCATION</div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                                        {lat.toFixed(5)}, {lng.toFixed(5)}
                                    </div>
                                </div>
                            </div>
                            <iframe
                                title="Check-in location"
                                src={mapUrl}
                                width="100%"
                                height="180"
                                style={{ border: 'none', display: 'block' }}
                                loading="lazy"
                            />
                        </div>
                    );
                })()}

                {/* Firebase not configured warning */}
                {!configured && (
                    <div style={{
                        marginTop: 14,
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--text3)', textAlign: 'center', letterSpacing: 1,
                        padding: '8px 12px', borderRadius: 6,
                        background: 'rgba(255,193,7,0.06)',
                        border: '1px solid rgba(255,193,7,0.15)',
                    }}>
                        ⚠️ Firebase not configured — check-in/out requires a live connection
                    </div>
                )}
            </div>

            {/* ── MONTHLY STATS ──────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'DAYS THIS MONTH', value: monthRecords.filter(r => r.checkIn).length },
                    { label: 'DAYS THIS WEEK', value: weekRecords.filter(r => r.checkIn).length },
                    { label: 'HRS THIS MONTH', value: fmtHours(totalHoursThisMonth) },
                ].map((s) => (
                    <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent)' }}>
                            {s.value}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: 2, marginTop: 4 }}>
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── ATTENDANCE HISTORY ─────────────────────────────────────────────── */}
            <div className="card">
                <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    letterSpacing: 3, color: 'var(--text3)', marginBottom: 16,
                }}>
                    MY ATTENDANCE HISTORY
                </div>

                {records.length === 0 ? (
                    <div style={{
                        textAlign: 'center', color: 'var(--text3)',
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        padding: '32px 0',
                    }}>
                        No records yet. Click <strong>CHECK IN</strong> to get started!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {records.slice(0, 30).map((r, i) => (
                            <div
                                key={`${r.date}-${i}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px', borderRadius: 8,
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                }}
                            >
                                <span
                                    className={`badge ${r.checkIn ? (r.checkOut ? 'badge-blue' : 'badge-green') : 'badge-red'}`}
                                    style={{ minWidth: 50, textAlign: 'center' }}
                                >
                                    {r.checkOut ? 'DONE' : r.checkIn ? 'IN' : 'ABS'}
                                </span>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', flex: 1 }}>
                                    {formatDate(r.date)}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                                    {tsToTime(r.checkIn)} → {tsToTime(r.checkOut)}
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', minWidth: 54, textAlign: 'right' }}>
                                    {fmtHours(r.totalHours)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
