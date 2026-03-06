// ─── useToast hook ────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import type { Toast } from '../types';

export function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
        const id = Date.now();
        setToasts((t) => [...t, { id, message, type }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    }, []);

    return { toasts, showToast };
}
