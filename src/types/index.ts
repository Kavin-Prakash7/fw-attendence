// ─── Shared TypeScript Types ───────────────────────────────────────────────────

export interface Employee {
    id: string;
    name: string;
    role: string;
    photo: string;
    joined: string;
}

export interface AttendanceRecord {
    empId: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    selfie: string | null;
    gps: { lat: string; lng: string } | null;
}

export interface User {
    email: string;
    name: string;
    role: string;
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export type ViewState = 'landing' | 'auth' | 'app';
export type PageState = 'dashboard' | 'employees' | 'attendance' | 'reports' | 'chatbot';
