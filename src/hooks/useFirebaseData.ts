// ─── useFirebaseData hook ─────────────────────────────────────────────────────
// Subscribes to Firestore real-time updates for employees and attendance.
// Falls back to localStorage when Firebase is not configured.
import { useState, useEffect } from 'react';
import { subscribeEmployees, subscribeAttendance } from '../firebase/services';
import type { Employee, AttendanceRecord } from '../types';

const DEMO_EMPLOYEES: Employee[] = [
    { id: 'EMP001', name: 'Aiden Blake', role: 'Photographer', photo: '', joined: '2024-01-15' },
    { id: 'EMP002', name: 'Sofia Chen', role: 'Photo Editor', photo: '', joined: '2024-02-01' },
    { id: 'EMP003', name: 'Marcus Reed', role: 'Videographer', photo: '', joined: '2024-03-10' },
    { id: 'EMP004', name: 'Luna Park', role: 'Studio Manager', photo: '', joined: '2023-11-20' },
];

function loadLocal() {
    try {
        const s = localStorage.getItem('fotoworld_state');
        if (s) return JSON.parse(s) as { employees: Employee[]; attendance: AttendanceRecord[] };
    } catch { }
    return { employees: DEMO_EMPLOYEES, attendance: [] as AttendanceRecord[] };
}

function saveLocal(employees: Employee[], attendance: AttendanceRecord[]) {
    try { localStorage.setItem('fotoworld_state', JSON.stringify({ employees, attendance })); } catch { }
}

export function isFirebaseConfigured(): boolean {
    const key = import.meta.env.VITE_FIREBASE_API_KEY;
    return !!key && key !== 'AIzaSyAySNwAv1S-b6G4ZHzGP2kg1GNPbhtqSmM';
}

export function useFirebaseData() {
    const configured = isFirebaseConfigured();
    const local = loadLocal();

    const [employees, setEmployees] = useState<Employee[]>(local.employees);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>(local.attendance);
    const [loading, setLoading] = useState(configured);

    // Persist to localStorage whenever data changes (offline cache / fallback)
    useEffect(() => { saveLocal(employees, attendance); }, [employees, attendance]);

    useEffect(() => {
        if (!configured) return;

        let unsubEmps: () => void;
        let unsubAtt: () => void;

        try {
            unsubEmps = subscribeEmployees((data) => {
                setEmployees(data);
                setLoading(false);
            });
            unsubAtt = subscribeAttendance((data) => {
                setAttendance(data);
            });
        } catch (err) {
            console.warn('Firebase subscription failed, using localStorage:', err);
            setLoading(false);
        }

        return () => {
            unsubEmps?.();
            unsubAtt?.();
        };
    }, [configured]);

    return { employees, setEmployees, attendance, setAttendance, loading, configured };
}
