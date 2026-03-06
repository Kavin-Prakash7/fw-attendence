// ─── useFirebaseData hook ─────────────────────────────────────────────────────
// Subscribes to Firestore real-time updates for employees and attendance.
// Falls back to localStorage when Firebase is not configured.
import { useState, useEffect } from 'react';
import { subscribeEmployees, subscribeAttendance, fetchEmployeeByUid } from '../firebase/services';
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
    const key = (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim();
    // Only treat as unconfigured if key is missing or is the literal placeholder text.
    // Do NOT blacklist the real API key — that was the bug causing permanent demo mode.
    return key.length > 0 && key !== 'YOUR_API_KEY';
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
            unsubAtt = subscribeAttendance(async (data) => {
                // ── Enrich staff attendance records with employee names ─────────
                // Staff check-ins store `employeeId` (Firebase Auth UID) instead
                // of `empId`. We batch-resolve any UIDs we haven't seen before
                // and attach `employeeName` to each record so the UI can always
                // show a human-readable name instead of a raw UID.

                // Collect unique employeeId values that need a name lookup
                const uidSet = new Set<string>();
                data.forEach((r) => {
                    const rawId = (r as any).employeeId as string | undefined;
                    if (rawId) uidSet.add(rawId);
                });

                // Fetch employee docs in parallel (one read per unique UID)
                const nameMap = new Map<string, string>();
                if (uidSet.size > 0) {
                    const results = await Promise.all(
                        Array.from(uidSet).map((uid) =>
                            fetchEmployeeByUid(uid).then((emp) => ({ uid, name: emp?.name ?? null }))
                        )
                    );
                    results.forEach(({ uid, name }) => {
                        if (name) nameMap.set(uid, name);
                    });
                }

                // Attach resolved name + normalise empId so existing lookup logic works
                const enriched: AttendanceRecord[] = data.map((r) => {
                    const rawEmployeeId = (r as any).employeeId as string | undefined;
                    if (!rawEmployeeId) return r; // legacy record — nothing to enrich

                    const resolvedName = nameMap.get(rawEmployeeId);
                    return {
                        ...r,
                        employeeId: rawEmployeeId,
                        // Mirror employeeId → empId so filters/lookups using empId also work
                        empId: r.empId || rawEmployeeId,
                        employeeName: resolvedName ?? undefined,
                    } as AttendanceRecord;
                });

                setAttendance(enriched);
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
