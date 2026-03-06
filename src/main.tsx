import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// ─── Service Worker Registration ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((reg) => {
                console.log('[SW] Registered, scope:', reg.scope);

                // Check for updates every 60 seconds while the app is open
                setInterval(() => reg.update(), 60_000);

                reg.addEventListener('updatefound', () => {
                    const newSW = reg.installing;
                    if (!newSW) return;
                    newSW.addEventListener('statechange', () => {
                        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[SW] New version available — reload to update');
                        }
                    });
                });
            })
            .catch((err) => console.warn('[SW] Registration failed:', err));
    });
}
