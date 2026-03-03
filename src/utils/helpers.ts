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

export function calcHours(record: { date: string; checkIn: string | null; checkOut: string | null }): string {
    if (!record.checkIn || !record.checkOut) return '—';
    const d = new Date(record.date);
    const [ih, im] = record.checkIn.split(':').map(Number);
    const [oh, om] = record.checkOut.split(':').map(Number);
    const start = new Date(d); start.setHours(ih, im);
    const end = new Date(d); end.setHours(oh, om);
    const hrs = (end.getTime() - start.getTime()) / 3_600_000;
    return hrs.toFixed(1) + 'h';
}

export function generateEmpId(existingCount: number): string {
    return 'EMP' + String(existingCount + 1).padStart(3, '0');
}
