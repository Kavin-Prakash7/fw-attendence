// ─── Landing Page ─────────────────────────────────────────────────────────────
interface Props { onLogin: () => void; }

export default function LandingPage({ onLogin }: Props) {
    return (
        <div className="landing">
            <nav className="nav">
                <div className="nav-logo">FOTO<span>WORLD</span></div>
                <button className="nav-cta" onClick={onLogin}>LOGIN</button>
            </nav>

            <section className="hero">
                <div className="hero-bg" />
                <div className="hero-grid" />
                <div className="hero-content">
                    <div className="hero-badge">PROFESSIONAL ATTENDANCE SYSTEM</div>
                    <h1 className="hero-title">FOTO<span>WORLD</span>ATTENDANCE</h1>
                    <p className="hero-sub">
                        Track your creative team with precision. Built for photography studios and media agencies.
                    </p>
                    <div className="hero-btns">
                        <button className="btn-primary" onClick={onLogin}>GET STARTED</button>
                        <button className="btn-outline" onClick={onLogin}>VIEW DEMO</button>
                    </div>
                </div>
            </section>

            <section className="stats-section">
                {([['500+', 'STUDIOS'], ['50K+', 'EMPLOYEES'], ['99.9%', 'UPTIME'], ['∞', 'MEMORIES']] as const).map(([n, l]) => (
                    <div key={l} className="stat-item">
                        <div className="stat-num">{n}</div>
                        <div className="stat-label">{l}</div>
                    </div>
                ))}
            </section>

            <section className="features" id="features">
                <div className="section-label">CORE FEATURES</div>
                <h2 className="section-title">EVERYTHING YOU NEED</h2>
                <div className="features-grid">
                    {[
                        ['📷', 'Camera Check-In', 'Selfie-based attendance capture for visual verification of each entry and exit.'],
                        ['📊', 'Live Dashboard', 'Real-time overview of who\'s present, total hours, and team activity at a glance.'],
                        ['🗓', 'Smart Reports', 'Filter attendance by date or employee. Export to CSV for payroll and audits.'],
                        ['🤖', 'AI Assistant', 'Ask natural questions like "Who\'s absent today?" and get instant answers.'],
                        ['📍', 'GPS Validation', 'Optional location-based check-in to ensure on-site presence.'],
                        ['📱', 'Mobile PWA', 'Install as an app on any device. Works offline. Touch-optimized interface.'],
                    ].map(([icon, title, desc]) => (
                        <div key={title as string} className="feature-card">
                            <div className="feature-icon">{icon}</div>
                            <div className="feature-title">{title}</div>
                            <p className="feature-desc">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="landing-footer">
                <div className="nav-logo" style={{ marginBottom: 12 }}>
                    FOTO<span style={{ color: 'var(--text3)' }}>WORLD</span>
                </div>
                <p>© 2025 FOTOWORLD ATTENDANCE · BUILT FOR CREATORS</p>
            </footer>
        </div>
    );
}
