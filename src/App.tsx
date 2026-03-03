// ─── App.tsx — Main Orchestrator ──────────────────────────────────────────────
import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import './style.css';

// Components
import ToastContainer from './components/ToastContainer';

// Pages (lazy-loaded for better initial load performance)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const AttendancePage = lazy(() => import('./pages/Attendance'));
const Reports = lazy(() => import('./pages/Reports'));
const Chatbot = lazy(() => import('./pages/Chatbot'));

// Hooks & Services
import { useToast } from './hooks/useToast';
import { useFirebaseData, isFirebaseConfigured } from './hooks/useFirebaseData';
import {
    addEmployee as fbAddEmployee,
    updateEmployee as fbUpdateEmployee,
    deleteEmployee as fbDeleteEmployee,
    checkIn as fbCheckIn,
    checkOut as fbCheckOut,
    signOut,
    uploadPhoto,
} from './firebase/services';

// Utils & Types
import { todayKey, nowTime, generateEmpId } from './utils/helpers';
import type { User, ViewState, PageState, Employee } from './types';

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function PageLoader() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', flexDirection: 'column', gap: 16,
        }}>
            <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: 3 }}>
                LOADING…
            </div>
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    const [view, setView] = useState<ViewState>('landing');
    const [page, setPage] = useState<PageState>('dashboard');
    const [user, setUser] = useState<User | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [clock, setClock] = useState(new Date().toLocaleTimeString());

    const { toasts, showToast } = useToast();
    const { employees, setEmployees, attendance, setAttendance, loading, configured } = useFirebaseData();

    // Clock tick
    useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Employee Actions ───────────────────────────────────────────────────────

    const addEmployee = useCallback(async (form: Omit<Employee, 'id' | 'joined'>) => {
        const joined = todayKey();
        if (configured) {
            await fbAddEmployee({ ...form, joined });
            showToast(`${form.name} added successfully!`);
        } else {
            const id = generateEmpId(employees.length);
            setEmployees((prev) => [...prev, { id, ...form, joined }]);
            showToast(`${form.name} added successfully!`);
        }
    }, [configured, employees.length, setEmployees, showToast]);

    const editEmployee = useCallback(async (id: string, form: Partial<Employee>) => {
        if (configured) {
            await fbUpdateEmployee(id, form);
        } else {
            setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, ...form } : e));
        }
        showToast('Employee updated.');
    }, [configured, setEmployees, showToast]);

    const deleteEmployee = useCallback(async (id: string) => {
        const emp = employees.find((e) => e.id === id);
        if (configured) {
            await fbDeleteEmployee(id);
        } else {
            setEmployees((prev) => prev.filter((e) => e.id !== id));
        }
        showToast(`${emp?.name} removed.`, 'info');
    }, [configured, employees, setEmployees, showToast]);

    // ── Attendance Actions ─────────────────────────────────────────────────────

    const checkIn = useCallback(async (
        empId: string,
        selfie: string | null,
        gps: { lat: string; lng: string } | null
    ) => {
        const today = todayKey();
        const existing = attendance.find((r) => r.empId === empId && r.date === today);
        if (existing?.checkIn) { showToast('Already checked in today.', 'error'); return; }

        const time = nowTime();

        if (configured) {
            // If there's a selfie and storage is available, upload it
            let selfieUrl = selfie;
            if (selfie && selfie.startsWith('data:')) {
                try { selfieUrl = await uploadPhoto(empId, selfie, 'selfie'); } catch { selfieUrl = selfie; }
            }
            await fbCheckIn(empId, today, time, selfieUrl, gps);
        } else {
            if (existing) {
                setAttendance((prev) => prev.map((r) =>
                    r.empId === empId && r.date === today ? { ...r, checkIn: time, selfie, gps } : r
                ));
            } else {
                setAttendance((prev) => [...prev, { empId, date: today, checkIn: time, checkOut: null, selfie, gps }]);
            }
        }

        const emp = employees.find((e) => e.id === empId);
        showToast(`${emp?.name} checked in at ${time}!`);
    }, [configured, attendance, employees, setAttendance, showToast]);

    const checkOut = useCallback(async (empId: string) => {
        const today = todayKey();
        const rec = attendance.find((r) => r.empId === empId && r.date === today);
        if (!rec?.checkIn) { showToast('Not checked in yet.', 'error'); return; }
        if (rec.checkOut) { showToast('Already checked out.', 'error'); return; }

        const time = nowTime();
        if (configured) {
            await fbCheckOut(empId, today, time);
        } else {
            setAttendance((prev) => prev.map((r) =>
                r.empId === empId && r.date === today ? { ...r, checkOut: time } : r
            ));
        }

        const emp = employees.find((e) => e.id === empId);
        showToast(`${emp?.name} checked out at ${time}!`);
    }, [configured, attendance, employees, setAttendance, showToast]);

    // ── Logout ─────────────────────────────────────────────────────────────────

    async function handleLogout() {
        if (configured) { try { await signOut(); } catch { } }
        setUser(null);
        setView('landing');
    }

    // ── Navigation items ───────────────────────────────────────────────────────
    const navItems: { id: PageState; icon: string; label: string }[] = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'employees', icon: '👥', label: 'Employees' },
        { id: 'attendance', icon: '⏰', label: 'Attendance' },
        { id: 'reports', icon: '📋', label: 'Reports' },
        { id: 'chatbot', icon: '🤖', label: 'AI Assistant' },
    ];

    const pageTitles: Record<PageState, string> = {
        dashboard: 'DASHBOARD',
        employees: 'EMPLOYEES',
        attendance: 'ATTENDANCE',
        reports: 'REPORTS',
        chatbot: 'AI ASSISTANT',
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (view === 'landing') return (
        <Suspense fallback={<PageLoader />}>
            <LandingPage onLogin={() => setView('auth')} />
        </Suspense>
    );

    if (view === 'auth') return (
        <Suspense fallback={<PageLoader />}>
            <AuthPage onAuth={(u) => { setUser(u); setView('app'); }} onBack={() => setView('landing')} />
        </Suspense>
    );

    // Loading from Firestore
    if (loading) return <PageLoader />;

    return (
        <>
            <ToastContainer toasts={toasts} />

            <div className="app-layout">
                {/* Sidebar backdrop on mobile */}
                <div className={`overlay-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

                {/* Sidebar */}
                <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-text">FOTOWORLD</div>
                        <div className="sidebar-logo-sub">ATTENDANCE SYSTEM</div>
                    </div>
                    <nav className="sidebar-nav">
                        <div className="nav-section-label">NAVIGATION</div>
                        {navItems.map((item) => (
                            <div
                                key={item.id}
                                className={`nav-item ${page === item.id ? 'active' : ''}`}
                                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                            >
                                <span className="nav-item-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </nav>
                    <div className="sidebar-footer">
                        <div className="sidebar-user">
                            <div className="user-avatar">{(user?.name ?? 'A')[0].toUpperCase()}</div>
                            <div className="user-info">
                                <div className="user-name">{user?.name ?? 'Admin'}</div>
                                <div className="user-role">{user?.role ?? 'ADMIN'}</div>
                            </div>
                            <button className="logout-btn" onClick={handleLogout} title="Logout">⏏</button>
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="main-content">
                    <div className="top-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
                            <div className="page-title">{pageTitles[page]}</div>
                        </div>
                        <div className="top-bar-right">
                            {configured && (
                                <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 2,
                                    color: 'var(--green)', background: 'rgba(46,204,113,0.08)',
                                    border: '1px solid rgba(46,204,113,0.2)', padding: '4px 10px', borderRadius: 4,
                                }}>
                                    🔥 LIVE
                                </span>
                            )}
                            <div className="time-badge">{clock}</div>
                        </div>
                    </div>

                    <div className="page-content">
                        <Suspense fallback={<PageLoader />}>
                            {page === 'dashboard' && <Dashboard employees={employees} attendance={attendance} onNav={setPage} />}
                            {page === 'employees' && <Employees employees={employees} attendance={attendance} onAdd={addEmployee} onEdit={editEmployee} onDelete={deleteEmployee} />}
                            {page === 'attendance' && <AttendancePage employees={employees} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} showToast={showToast} />}
                            {page === 'reports' && <Reports employees={employees} attendance={attendance} />}
                            {page === 'chatbot' && <Chatbot employees={employees} attendance={attendance} />}
                        </Suspense>
                    </div>
                </div>
            </div>

            {/* Firebase banner when not configured */}
            {!configured && (
                <div className="fb-banner">
                    ⚡ Running in demo mode · Add your Firebase credentials to <code style={{ margin: '0 4px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>.env</code> to enable live sync
                </div>
            )}
        </>
    );
}
