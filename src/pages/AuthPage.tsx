// ─── Auth Page ────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { signIn as firebaseSignIn } from '../firebase/services';
import { isFirebaseConfigured } from '../hooks/useFirebaseData';
import type { User } from '../types';

interface Props {
    onAuth: (user: User) => void;
    onBack: () => void;
}

export default function AuthPage({ onAuth, onBack }: Props) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const configured = isFirebaseConfigured();

    async function handleSubmit() {
        if (!email || !pass) { setError('Please fill all fields.'); return; }
        setBusy(true);
        setError('');

        try {
            if (configured) {
                // Real Firebase auth
                const fbUser = await firebaseSignIn(email, pass);
                onAuth({ email: fbUser.email ?? email, name: fbUser.displayName ?? email.split('@')[0], role: 'ADMIN' });
            } else {
                // Demo mode
                if (email === 'admin@fotoworld.com' && pass === 'admin123') {
                    onAuth({ email, name: 'Admin User', role: 'ADMIN' });
                } else if (pass.length >= 4) {
                    onAuth({ email, name: email.split('@')[0], role: 'ADMIN' });
                } else {
                    setError('Invalid credentials. Use demo: admin@fotoworld.com / admin123');
                }
            }
        } catch (err: any) {
            setError(err?.message ?? 'Sign-in failed. Check your credentials.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-bg" />
            <div className="auth-card">
                <div className="auth-logo">FOTOWORLD</div>
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

                <button className="btn-primary btn-full" onClick={handleSubmit} disabled={busy}>
                    {busy ? <span className="spinner" /> : 'SIGN IN'}
                </button>

                {!configured && (
                    <div className="demo-hint">
                        DEMO CREDENTIALS<br />
                        Email: admin@fotoworld.com<br />
                        Password: admin123
                    </div>
                )}
                {configured && (
                    <div className="demo-hint" style={{ borderColor: 'rgba(46,204,113,0.3)', color: 'var(--green)' }}>
                        🔥 Firebase connected — use your registered account
                    </div>
                )}

                <span className="auth-back" onClick={onBack}>← Back to home</span>
            </div>
        </div>
    );
}
