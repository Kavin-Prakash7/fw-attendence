// ─── Auth Page ────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { signIn as firebaseSignIn, getUserProfile, fetchEmployeeByUid } from '../firebase/services';
import { isFirebaseConfigured } from '../hooks/useFirebaseData';
import type { User } from '../types';

// ─── Friendly error messages ──────────────────────────────────────────────────
/** Maps Firebase / network errors to clear, jargon-free messages. */
function friendlyAuthError(err: any): string {
    const code: string = err?.code ?? '';
    const msg: string = err?.message ?? '';

    // Firebase Auth error codes
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' || code === 'auth/invalid-email') {
        return 'Incorrect email or password. Please try again.';
    }
    if (code === 'auth/too-many-requests') {
        return 'Too many failed attempts. Please wait a moment and try again.';
    }
    if (code === 'auth/user-disabled') {
        return 'Your account has been disabled. Contact your administrator.';
    }
    if (code === 'auth/network-request-failed' ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('offline') ||
        msg.toLowerCase().includes('client is offline')) {
        return 'No internet connection. Please check your network and try again.';
    }
    if (code === 'auth/email-already-in-use') {
        return 'This email is already registered.';
    }
    if (code.startsWith('auth/')) {
        // Generic Firebase Auth error
        return 'Sign-in failed. Please check your credentials and try again.';
    }
    // Firestore / unknown errors — never expose raw messages
    return 'Something went wrong. Please try again.';
}

interface Props {
    onAuth: (user: User) => void;
    onBack: () => void;
}

export default function AuthPage({ onAuth, onBack }: Props) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const configured = isFirebaseConfigured();

    async function handleSubmit() {
        if (!email || !pass) { setError('Please fill all fields.'); return; }
        setBusy(true);
        setError('');

        let loginSuccess = false;

        try {
            if (configured) {
                // ── Real Firebase auth ──────────────────────────────────────
                const fbUser = await firebaseSignIn(email, pass);
                console.log('[AuthPage] Signed in, UID:', fbUser.uid);

                loginSuccess = true;
                setError('');

                const fallbackName = fbUser.displayName ?? email.split('@')[0];

                // Fetch (or auto-create) role profile from Firestore.
                // getUserProfile now always returns a profile; if the document
                // was missing it creates one with role = 'STAFF' automatically.
                const profile = await getUserProfile(
                    fbUser.uid,
                    fbUser.email ?? email,
                    fallbackName,
                );
                console.log('[AuthPage] User profile:', profile);

                // ── Resolve employee record: employees/{uid} direct doc lookup ──
                // Structure: employees/{uid} — Firestore doc ID IS the Auth UID.
                let resolvedEmpId = profile.empId;
                if (profile.role === 'STAFF') {
                    const linkedEmployee = await fetchEmployeeByUid(fbUser.uid);
                    console.log('Logged in UID:', fbUser.uid);
                    console.log('Employee doc exists:', linkedEmployee !== null);
                    if (linkedEmployee) {
                        resolvedEmpId = linkedEmployee.id;
                    } else {
                        console.warn('No employee document found at employees/' + fbUser.uid);
                    }
                }

                onAuth({
                    uid: fbUser.uid,
                    email: profile.email,
                    name: profile.name,
                    role: profile.role,
                    empId: resolvedEmpId,
                });
            } else {
                // ── Demo mode — role based on email prefix ──────────────────
                if (email === 'admin@fotoworld.com' && pass === 'admin123') {
                    loginSuccess = true;
                    setError('');
                    onAuth({ uid: 'demo-admin', email, name: 'Admin User', role: 'ADMIN' });
                } else if (email.startsWith('staff') && pass.length >= 4) {
                    loginSuccess = true;
                    setError('');
                    onAuth({ uid: 'demo-staff', email, name: email.split('@')[0], role: 'STAFF', empId: 'EMP001' });
                } else if (pass.length >= 4) {
                    loginSuccess = true;
                    setError('');
                    onAuth({ uid: 'demo-admin-2', email, name: email.split('@')[0], role: 'ADMIN' });
                } else {
                    setError('Invalid credentials. Demo: admin@fotoworld.com / admin123');
                }
            }
        } catch (err: any) {
            console.error(err);
            // ── Translate Firebase / network error codes into friendly messages
            if (!loginSuccess) {
                setError(friendlyAuthError(err));
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-bg" />

            {configured && (
                <div style={{
                    position: 'absolute',
                    top: 32,
                    right: 32,
                    background: '#FFFFFF',
                    padding: '8px 16px',
                    borderRadius: 20,
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#1E3A8A',
                    zIndex: 10
                }}>
                    <span>🔥</span>
                    <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: isOnline ? '#22c55e' : '#ef4444'
                    }} />
                    {/* <span>Firebase {isOnline ? 'Live' : 'Offline'}</span> */}
                </div>
            )}

            <div className="auth-card">
                <img src="/logo.png" alt="FotoWorld Logo" style={{ height: 48, margin: '0 auto 16px', display: 'block' }} />
                <div className="auth-sub">ATTENDANCE SYSTEM</div>

                {error && <div className="auth-error">{error}</div>}

                <div className="form-group">
                    <label className="form-label">EMAIL ADDRESS</label>
                    <input
                        className="form-input"
                        type="email"
                        placeholder="admin@fotoworld.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">PASSWORD</label>
                    <input
                        className="form-input"
                        type="password"
                        placeholder="••••••••"
                        value={pass}
                        onChange={(e) => { setPass(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                </div>

                <button className="btn-accent btn-full" onClick={handleSubmit} disabled={busy}>
                    {busy ? <span className="spinner" /> : 'SIGN IN'}
                </button>

                {!configured && (
                    <div className="demo-hint">
                        DEMO CREDENTIALS<br />
                        Admin: admin@fotoworld.com / admin123<br />
                        Staff: staff@fotoworld.com / staff123
                    </div>
                )}

                <span className="auth-back" onClick={onBack}>← Back to home</span>
            </div>
        </div>
    );
}
