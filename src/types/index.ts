// ─── Shared TypeScript Types ───────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'STAFF';

export interface Employee {
    id: string;
    name: string;
    role: string;
    photo: string;
    joined: string;
    uid?: string;          // Firebase Auth UID (doc ID = uid when created via admin panel)
    userId?: string;       // Legacy alias — links employee record to a staff login
    email?: string;        // Staff login email
    salaryPerDay?: number; // Daily salary amount
    checkInTime?: string;  // Expected check-in time e.g. "09:00"
    checkOutTime?: string; // Expected check-out time e.g. "18:00"
}

export interface AttendanceRecord {
    empId: string;
    date: string;
    checkIn: string | null | unknown;   // string (legacy) or Firestore Timestamp (staff)
    checkOut: string | null | unknown;  // string (legacy) or Firestore Timestamp (staff)
    selfie: string | null;
    gps: { lat: string; lng: string } | null;
    /** Firebase Auth UID — present on staff check-in records */
    employeeId?: string;
    /** Resolved display name, populated by useFirebaseData after employee lookup */
    employeeName?: string;
}

/**
 * New structure used by the staff check-in/out system.
 * Stored in: attendance/{employeeId}_{date}
 * employeeId = Firebase Auth UID (same as the employees doc ID)
 */
export interface StaffAttendanceRecord {
    employeeId: string;         // Firebase Auth UID
    date: string;               // "YYYY-MM-DD"
    checkIn: unknown | null;    // Firestore Timestamp (serverTimestamp)
    checkOut: unknown | null;   // Firestore Timestamp (serverTimestamp)
    totalHours: number | null;  // decimal hours, e.g. 8.5
    location?: { lat: number; lng: number } | null;
}

export interface User {
    uid: string;          // Firebase Auth UID
    email: string;
    name: string;
    role: UserRole;       // 'ADMIN' | 'STAFF'
    empId?: string;       // Links to Employee record (STAFF only)
}

export interface UserProfile {
    uid: string;
    email: string;
    name: string;
    role: UserRole;
    empId?: string;
    createdAt?: unknown;
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export type ViewState = 'landing' | 'auth' | 'app';
export type PageState =
    | 'dashboard'
    | 'employees'
    | 'attendance'
    | 'reports'
    | 'chatbot'
    | 'analytics'
    | 'my-attendance'    // STAFF: personal attendance
    | 'staff-chatbot';   // STAFF: personal AI assistant
