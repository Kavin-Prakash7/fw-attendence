// ─── Attendance Page ──────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { todayKey, formatDate, getInitials } from '../utils/helpers';
import type { Employee, AttendanceRecord } from '../types';

/** Safely convert a checkIn/checkOut value (Timestamp | string | null | unknown) to a display string */
function toDisplayTime(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof (val as any)?.toDate === 'function') {
        return (val as any).toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (typeof val === 'string') return val || '—';
    return String(val);
}

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
    onCheckIn: (empId: string, selfie: string | null, gps: { lat: string; lng: string } | null) => Promise<void>;
    onCheckOut: (empId: string) => Promise<void>;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AttendancePage({ employees, attendance, onCheckIn, onCheckOut, showToast }: Props) {
    const [cameraModal, setCameraModal] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [captured, setCaptured] = useState<string | null>(null);
    const [gps, setGps] = useState<{ lat: string; lng: string } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const today = todayKey();

    async function openCamera(empId: string) {
        setCaptured(null);
        setGps(null);
        setCameraModal(empId);

        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setStream(s);
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
        } catch {
            showToast('Camera not available. Proceeding without photo.', 'info');
            setCameraModal(null);
            doCheckIn(empId, null);
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGps({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }),
                () => setGps(null)
            );
        }
    }

    function capture() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        setCaptured(canvas.toDataURL('image/jpeg', 0.6));
    }

    function stopCamera() {
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        setCameraModal(null);
        setCaptured(null);
    }

    async function confirmCheckIn() {
        await doCheckIn(cameraModal!, captured);
        stopCamera();
    }

    async function doCheckIn(empId: string, selfie: string | null) {
        setBusyId(empId);
        await onCheckIn(empId, selfie, gps);
        setBusyId(null);
    }

    async function handleCheckOut(empId: string) {
        setBusyId(empId);
        await onCheckOut(empId);
        setBusyId(null);
    }

    return (
        <div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>TODAY —</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 3, color: 'var(--accent)' }}>
                    {formatDate(today)}
                </div>
            </div>

            <div className="att-grid">
                {employees.map((emp) => {
                    const rec = attendance.find((r) => r.empId === emp.id && r.date === today);
                    const hasIn = !!(rec?.checkIn);
                    const hasOut = !!(rec?.checkOut);
                    const busy = busyId === emp.id;

                    return (
                        <div key={emp.id} className="att-card">
                            <div className="att-card-header">
                                <div className="activity-avatar" style={{ width: 50, height: 50, fontSize: 18 }}>
                                    {emp.photo ? <img src={emp.photo} alt="" /> : getInitials(emp.name)}
                                </div>
                                <div className="att-emp-info">
                                    <div className="att-emp-name">{emp.name}</div>
                                    <div className="att-emp-role">{emp.role}</div>
                                </div>
                                <span className={`badge ${hasIn ? (hasOut ? 'badge-blue' : 'badge-green') : 'badge-red'}`}>
                                    {hasOut ? 'DONE' : hasIn ? 'IN' : 'ABSENT'}
                                </span>
                            </div>

                            {rec?.selfie && (
                                <div style={{ marginBottom: 12 }}>
                                    <img src={rec.selfie} alt="Check-in selfie" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                                </div>
                            )}

                            <div className="att-times">
                                <div className="att-time-block">
                                    <div className="att-time-label">CHECK IN</div>
                                    <div className={`att-time-value ${!rec?.checkIn ? 'na' : ''}`}>{toDisplayTime(rec?.checkIn)}</div>
                                </div>
                                <div className="att-time-block">
                                    <div className="att-time-label">CHECK OUT</div>
                                    <div className={`att-time-value ${!rec?.checkOut ? 'na' : ''}`}>{toDisplayTime(rec?.checkOut)}</div>
                                </div>
                            </div>

                            {rec?.gps && (
                                <div className="gps-status" style={{ marginBottom: 12 }}>
                                    📍 <span>{rec.gps.lat}, {rec.gps.lng}</span>
                                    <a
                                        href={`https://www.google.com/maps?q=${rec.gps.lat},${rec.gps.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-ghost"
                                        style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
                                    >
                                        View Location
                                    </a>
                                </div>
                            )}

                            {(rec as any)?.location && (
                                <div className="gps-status" style={{ marginBottom: 12 }}>
                                    📍 <span>{(rec as any).location.lat}, {(rec as any).location.lng}</span>
                                    <a
                                        href={`https://www.google.com/maps?q=${(rec as any).location.lat},${(rec as any).location.lng}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-ghost"
                                        style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}
                                    >
                                        View Location
                                    </a>
                                </div>
                            )}

                            {!hasIn ? (
                                <button className="att-btn-in" onClick={() => openCamera(emp.id)} disabled={busy}>
                                    {busy ? <span className="spinner" /> : '📷 CHECK IN'}
                                </button>
                            ) : !hasOut ? (
                                <button className="att-btn-out" onClick={() => handleCheckOut(emp.id)} disabled={busy}>
                                    {busy ? <span className="spinner" /> : 'CHECK OUT'}
                                </button>
                            ) : (
                                <div className="att-done-msg">✓ COMPLETED FOR TODAY</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Camera Modal */}
            {cameraModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <div className="modal-title">CAPTURE SELFIE</div>
                            <button className="modal-close" onClick={stopCamera}>×</button>
                        </div>
                        <div className="camera-preview" style={{ height: 240, background: '#000' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: captured ? 'none' : 'block' }}
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            {captured && (
                                <img src={captured} alt="captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                        </div>
                        {gps && (
                            <div className="gps-status" style={{ margin: '12px 0' }}>📍 Location: {gps.lat}, {gps.lng}</div>
                        )}
                        {!gps && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', margin: '8px 0', letterSpacing: 1 }}>
                                Requesting GPS...
                            </div>
                        )}
                        <div className="camera-controls" style={{ marginTop: 12 }}>
                            {!captured ? (
                                <>
                                    <button className="btn-accent" style={{ flex: 1 }} onClick={capture}>📸 CAPTURE</button>
                                    <button className="btn-ghost" onClick={() => { stopCamera(); doCheckIn(cameraModal, null); }}>Skip Photo</button>
                                </>
                            ) : (
                                <>
                                    <button className="btn-accent" style={{ flex: 1 }} onClick={confirmCheckIn}>✓ CONFIRM CHECK-IN</button>
                                    <button className="btn-ghost" onClick={() => setCaptured(null)}>Retake</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
