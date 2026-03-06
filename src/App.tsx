// ─── App.tsx — Main Orchestrator with Role-Based Access ───────────────────────
import { useState, useEffect, lazy, Suspense, useCallback, ReactNode } from 'react';
import { LayoutDashboard, Users, Clock, BarChart3, Sparkles, TrendingUp } from 'lucide-react';
import './style.css';

// Components
import ToastContainer from './components/ToastContainer';

// Pages (lazy-loaded)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const AttendancePage = lazy(() => import('./pages/Attendance'));
const Reports = lazy(() => import('./pages/Reports'));
const Chatbot = lazy(() => import('./pages/Chatbot'));
const StaffAttendance = lazy(() => import('./pages/StaffAttendance'));
const StaffChatbot = lazy(() => import('./pages/StaffChatbot'));
const Analytics = lazy(() => import('./pages/Analytics'));

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

// ─── Role Guard ───────────────────────────────────────────────────────────────
/** Pages only ADMIN can access */
const ADMIN_ONLY_PAGES: PageState[] = ['dashboard', 'employees', 'reports', 'chatbot', 'analytics'];
/** Pages only STAFF can access */
const STAFF_ONLY_PAGES: PageState[] = ['my-attendance', 'staff-chatbot'];

function isPageAllowed(page: PageState, role: 'ADMIN' | 'STAFF'): boolean {
    if (role === 'ADMIN') return !STAFF_ONLY_PAGES.includes(page);
    if (role === 'STAFF') return !ADMIN_ONLY_PAGES.includes(page);
    return false;
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

    // When user role is determined, redirect to correct default page
    useEffect(() => {
        if (user) {
            setPage(user.role === 'STAFF' ? 'my-attendance' : 'dashboard');
        }
    }, [user]);

    // Guard: if current page is not allowed for this role, redirect
    useEffect(() => {
        if (user && !isPageAllowed(page, user.role)) {
            setPage(user.role === 'STAFF' ? 'my-attendance' : 'dashboard');
        }
    }, [page, user]);

    // ── STAFF attendance records (for StaffChatbot context) ─────────────────
    // Filtered from the global subscription using the UID field that staff
    // check-in records write as `employeeId`.
    const myAttendance = user?.role === 'STAFF'
        ? attendance.filter((r) => (r as any).employeeId === user.uid)
        : [];

    // ── Employee Actions (ADMIN only) ──────────────────────────────────────────

    const addEmployee = useCallback(async (form: Omit<Employee, 'id' | 'joined'>) => {
        // Fallback: used only in demo mode (no Firebase)
        const joined = todayKey();
        const id = generateEmpId(employees.length);
        setEmployees((prev) => [...prev, { id, ...form, joined }]);
        showToast(`${form.name} added successfully!`);
    }, [employees.length, setEmployees, showToast]);

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
        showToast(`${emp?.name ?? 'You'} checked in at ${time}!`);
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
        showToast(`${emp?.name ?? 'You'} checked out at ${time}!`);
    }, [configured, attendance, employees, setAttendance, showToast]);

    // ── Logout ─────────────────────────────────────────────────────────────────

    async function handleLogout() {
        if (configured) { try { await signOut(); } catch { } }
        setUser(null);
        setView('landing');
    }

    // ── Guarded page navigation ────────────────────────────────────────────────
    function navigate(target: PageState) {
        if (!user || !isPageAllowed(target, user.role)) return;
        setPage(target);
        setSidebarOpen(false);
    }

    // ── Nav items (role-filtered) ───────────────────────────────────────────────
    const adminNavItems: { id: PageState; icon: ReactNode; label: string }[] = [
        { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { id: 'employees', icon: <Users size={20} />, label: 'Employees' },
        { id: 'attendance', icon: <Clock size={20} />, label: 'Attendance' },
        { id: 'analytics', icon: <TrendingUp size={20} />, label: 'Analytics' },
        { id: 'reports', icon: <BarChart3 size={20} />, label: 'Reports' },
        { id: 'chatbot', icon: <Sparkles size={20} />, label: 'AI Assistant' },
    ];

    const staffNavItems: { id: PageState; icon: ReactNode; label: string }[] = [
        { id: 'my-attendance', icon: <Clock size={20} />, label: 'My Attendance' },
        { id: 'staff-chatbot', icon: <Sparkles size={20} />, label: 'My AI Assistant' },
    ];

    const navItems = user?.role === 'STAFF' ? staffNavItems : adminNavItems;

    const pageTitles: Record<PageState, string> = {
        dashboard: 'DASHBOARD',
        employees: 'EMPLOYEES',
        attendance: 'ATTENDANCE',
        reports: 'REPORTS',
        chatbot: 'AI ASSISTANT',
        analytics: 'ANALYTICS',
        'my-attendance': 'MY ATTENDANCE',
        'staff-chatbot': 'MY AI ASSISTANT',
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

    if (loading) return <PageLoader />;

    const isAdmin = user?.role === 'ADMIN';
    const isStaff = user?.role === 'STAFF';

    return (
        <>
            <ToastContainer toasts={toasts} />

            <div className="app-layout">
                {/* Sidebar backdrop on mobile */}
                <div className={`overlay-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

                {/* ── TOP NAVBAR ── */}
                <div className="top-bar">
                    <div className="top-bar-left" onClick={() => navigate(isAdmin ? 'dashboard' : 'my-attendance')} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/logo.png" alt="FotoWorld Logo" style={{ height: 40, display: 'block' }} />
                    </div>

                    <div className="top-bar-right">
                        {configured && (
                            <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 2,
                                color: 'var(--green)', background: 'rgba(46,204,113,0.08)',
                                border: '1px solid rgba(46,204,113,0.2)', padding: '4px 10px', borderRadius: 4,
                                display: 'none',
                            }} className="desktop-only">
                                🔥 LIVE
                            </span>
                        )}
                        <div className="time-badge desktop-only" style={{ display: 'none' }}>{clock}</div>

                        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

                        <div className="user-info" style={{ textAlign: 'right' }}>
                            <div className="user-name">{user?.name ?? 'User'}</div>
                            <div className="user-role">{user?.role ?? 'ADMIN'}</div>
                        </div>
                        <div className="user-avatar">{(user?.name ?? 'A')[0].toUpperCase()}</div>
                        <button className="logout-btn" onClick={handleLogout} title="Logout" style={{ marginLeft: 8 }}>⏏</button>

                        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginLeft: 8 }}>☰</button>
                    </div>
                </div>

                <div className="main-body">
                    {/* ── SIDEBAR ── */}
                    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                        <nav className="sidebar-nav">
                            <div className="nav-section-label">NAVIGATION</div>
                            {navItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`nav-item ${page === item.id ? 'active' : ''}`}
                                    onClick={() => navigate(item.id)}
                                >
                                    <span className="nav-item-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </nav>

                        <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                            Status: <span style={{ color: 'var(--green)' }}>Online</span>
                        </div>
                    </div>

                    {/* ── MAIN CONTENT ── */}
                    <div className="main-content">
                        <div className="page-content">
                            <div className="page-title">{pageTitles[page]}</div>
                            <Suspense fallback={<PageLoader />}>
                                {/* ── ADMIN pages ── */}
                                {isAdmin && page === 'dashboard' && (
                                    <Dashboard employees={employees} attendance={attendance} onNav={(p) => navigate(p as PageState)} />
                                )}
                                {isAdmin && page === 'employees' && (
                                    <Employees employees={employees} attendance={attendance} onAdd={addEmployee} onEdit={editEmployee} onDelete={deleteEmployee} showToast={showToast} />
                                )}
                                {isAdmin && page === 'attendance' && (
                                    <AttendancePage employees={employees} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} showToast={showToast} />
                                )}
                                {isAdmin && page === 'reports' && (
                                    <Reports employees={employees} attendance={attendance} />
                                )}
                                {isAdmin && page === 'analytics' && (
                                    <Analytics employees={employees} attendance={attendance} />
                                )}
                                {isAdmin && page === 'chatbot' && (
                                    <Chatbot employees={employees} attendance={attendance} />
                                )}

                                {/* ── STAFF pages ── */}
                                {isStaff && page === 'my-attendance' && user && (
                                    <StaffAttendance
                                        uid={user.uid}
                                        userName={user.name}
                                        showToast={showToast}
                                    />
                                )}
                                {isStaff && page === 'staff-chatbot' && (
                                    <StaffChatbot
                                        employeeName={user?.name ?? 'Staff'}
                                        myAttendance={myAttendance}
                                    />
                                )}
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>

            {/* Demo mode banner */}
            {!configured && (
                <div className="fb-banner">
                    ⚡ Running in demo mode · Add your Firebase credentials to <code style={{ margin: '0 4px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>.env</code> to enable live sync
                </div>
            )}
        </>
    );
}
