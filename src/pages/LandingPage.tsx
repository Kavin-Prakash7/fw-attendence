// ─── Landing Page ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, BarChart3, Sparkles, Download, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props { onLogin: () => void; }

export default function LandingPage({ onLogin }: Props) {
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
    const [installState, setInstallState] = useState<'idle' | 'success' | 'dismissed'>('idle');
    const [showInstallBanner, setShowInstallBanner] = useState(true);

    async function handleInstall() {
        const result = await promptInstall();
        if (result === 'accepted') setInstallState('success');
        else if (result === 'dismissed') setInstallState('dismissed');
    }

    return (
        <div className="landing">
            <nav className="nav">
                <a href="/" className="nav-logo-link">
                    <img src="/logo.png" alt="FotoWorld Logo" className="nav-logo-img" />
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isInstallable && !isInstalled && (
                        <button className="pwa-install-btn-nav" onClick={handleInstall} title="Install app">
                            <Download size={15} />
                            <span>Install</span>
                        </button>
                    )}
                    {isInstalled && (
                        <span className="pwa-installed-badge">
                            <CheckCircle2 size={14} /> Installed
                        </span>
                    )}
                    <button className="nav-cta" onClick={onLogin}>LOGIN</button>
                </div>
            </nav>

            {/* ── PWA Install Banner ─────────────────────────────────────────── */}
            <AnimatePresence>
                {isInstallable && !isInstalled && showInstallBanner && installState === 'idle' && (
                    <motion.div
                        className="pwa-banner"
                        initial={{ y: -80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                        <img src="/favicon.png" alt="FotoWorld" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Install FotoWorld App</div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                                Add to home screen for quick access &amp; offline use
                            </div>
                        </div>
                        <button className="pwa-install-btn" onClick={handleInstall}>
                            <Download size={14} /> Install
                        </button>
                        <button className="pwa-dismiss-btn" onClick={() => setShowInstallBanner(false)} title="Dismiss">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <section className="hero-wrap">
                <div className="hero">
                    <motion.div
                        className="hero-content-left"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="hero-title">FotoWorld Attendance System</h1>
                        <h2 className="hero-sub">Capturing Your Moments by Our Movements.</h2>
                        <p className="hero-desc">
                            Manage staff attendance, working hours, and studio operations efficiently.
                        </p>
                        <div className="hero-btns">
                            <button className="btn-primary" onClick={onLogin}>LOGIN</button>
                            {isInstallable && !isInstalled && (
                                <motion.button
                                    className="btn-install-hero"
                                    onClick={handleInstall}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <Download size={18} />
                                    Install FotoWorld App
                                </motion.button>
                            )}
                            {isInstalled && (
                                <span className="pwa-installed-hero">
                                    <CheckCircle2 size={18} /> App Installed
                                </span>
                            )}
                        </div>
                        {installState === 'success' && (
                            <motion.div
                                className="pwa-success-msg"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                🎉 FotoWorld has been installed on your device!
                            </motion.div>
                        )}
                    </motion.div>

                    <motion.div
                        className="hero-content-right"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className="hero-logo-card">
                            <img src="/logo.png" alt="FotoWorld Hero Graphic" className="hero-graphic" />
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="features" id="features">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="section-label">CORE FEATURES</div>
                    <h2 className="section-title">EVERYTHING YOU NEED</h2>
                </motion.div>

                <div className="features-grid">
                    {[
                        { icon: <Camera size={48} strokeWidth={1.5} />, title: 'Smart Attendance', desc: 'Selfie and GPS-based validation to perfectly track on-site presence.' },
                        { icon: <BarChart3 size={48} strokeWidth={1.5} />, title: 'Staff Analytics', desc: 'Real-time overview of attendance, missing hours, and deep visual reports.' },
                        { icon: <Sparkles size={48} strokeWidth={1.5} />, title: 'AI Assistant', desc: 'Ask natural questions directly to your specialized AI assistant to get answers.' },
                        { icon: <Download size={48} strokeWidth={1.5} />, title: 'Works Offline', desc: 'Installed as a PWA — works even with no internet connection on any device.' },
                    ].map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            className="feature-card"
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                        >
                            <div className="feature-icon">{feat.icon}</div>
                            <div className="feature-title">{feat.title}</div>
                            <p className="feature-desc">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ── Install CTA Section ── */}
                {isInstallable && !isInstalled && (
                    <motion.div
                        className="pwa-cta-section"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className="pwa-cta-icon">📱</div>
                        <h3 className="pwa-cta-title">Install on Your Device</h3>
                        <p className="pwa-cta-desc">
                            Add FotoWorld Attendance to your home screen for instant access, offline capability,
                            and a native app experience — no App Store needed.
                        </p>
                        <button className="pwa-cta-btn" onClick={handleInstall}>
                            <Download size={20} />
                            Install FotoWorld App
                        </button>
                    </motion.div>
                )}
            </section>

            <footer className="landing-footer">
                <img src="/logo.png" alt="FotoWorld" style={{ height: 32, margin: '0 auto', display: 'block' }} />
                <p>FotoWorld Attendance System</p>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>© FotoWorld Colour Lab &amp; Studio</p>
            </footer>
        </div>
    );
}
