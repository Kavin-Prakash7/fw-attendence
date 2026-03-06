// ─── Utility Helpers ─────────────────────────────────────────────────────────

export function todayKey(): string {
    return new Date().toISOString().split('T')[0];
}

export function nowTime(): string {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Calculate hours worked from checkIn and checkOut.
 * Handles both Firestore Timestamp objects and legacy time strings.
 *
 * @param record - Must have `date` (YYYY-MM-DD string), `checkIn`, `checkOut`.
 *                 checkIn / checkOut can be:
 *                   • Firestore Timestamp  → .toDate() used directly
 *                   • string "HH:MM" / "HH:MM AM"  → parsed with date context
 *                   • null / undefined  → returns "—"
 */
export function calcHours(record: {
    date: string;
    checkIn: unknown | null;
    checkOut: unknown | null;
}): string {
    if (!record.checkIn || !record.checkOut) return '—';

    let start: Date | null = null;
    let end: Date | null = null;

    // ── Resolve checkIn ──────────────────────────────────────────────────────
    if (typeof (record.checkIn as any)?.toDate === 'function') {
        // Firestore Timestamp: const checkIn = record.checkIn.toDate()
        start = (record.checkIn as any).toDate() as Date;
    } else if (typeof record.checkIn === 'string' && record.checkIn.length > 0) {
        // Legacy string e.g. "09:30 AM" — combine with date for correct parsing
        const d = new Date(`${record.date} ${record.checkIn}`);
        if (!isNaN(d.getTime())) start = d;
    }

    // ── Resolve checkOut ─────────────────────────────────────────────────────
    if (typeof (record.checkOut as any)?.toDate === 'function') {
        // Firestore Timestamp: const checkOut = record.checkOut.toDate()
        end = (record.checkOut as any).toDate() as Date;
    } else if (typeof record.checkOut === 'string' && record.checkOut.length > 0) {
        const d = new Date(`${record.date} ${record.checkOut}`);
        if (!isNaN(d.getTime())) end = d;
    }

    if (!start || !end) return '—';

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '—';

    const hrs = Math.floor(diffMs / 3_600_000);
    const mins = Math.round((diffMs % 3_600_000) / 60_000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function generateEmpId(existingCount: number): string {
    return 'EMP' + String(existingCount + 1).padStart(3, '0');
}
