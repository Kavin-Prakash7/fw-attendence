// ─── Firebase Service Layer ───────────────────────────────────────────────────
// All Firestore and Auth calls go here, keeping components clean.
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, query, orderBy, onSnapshot, setDoc, serverTimestamp,
    where, getDoc,
} from 'firebase/firestore';
import {
    signInWithEmailAndPassword, signOut as firebaseSignOut,
    onAuthStateChanged, User as FirebaseUser,
} from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './config';
import type { Employee, AttendanceRecord, UserProfile } from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
}

export function onAuthChange(cb: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, cb);
}

// ── User Profiles (role system) ───────────────────────────────────────────────

const USERS = 'userProfiles';

/**
 * Fetch user profile (role, empId, etc.) from Firestore.
 * If no document exists yet, a default STAFF profile is automatically
 * created and returned so first-time users are always handled gracefully.
 */
export async function getUserProfile(
    uid: string,
    fallbackEmail: string,
    fallbackName: string,
): Promise<UserProfile> {
    const ref_ = doc(db, USERS, uid);
    const snap = await getDoc(ref_);

    if (snap.exists()) {
        return snap.data() as UserProfile;
    }

    // Document missing — create a default STAFF profile
    const defaultProfile: UserProfile = {
        uid,
        email: fallbackEmail,
        name: fallbackName,
        role: 'STAFF',
    };

    await setDoc(ref_, {
        ...defaultProfile,
        createdAt: serverTimestamp(),
    });

    return defaultProfile;
}

/** Create or update a user profile (called on first login or admin provisioning) */
export async function createUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, USERS, profile.uid), {
        ...profile,
        createdAt: serverTimestamp(),
    }, { merge: true });
}

// ── Employees ─────────────────────────────────────────────────────────────────

const EMPS = 'employees';

export async function fetchEmployees(): Promise<Employee[]> {
    const snap = await getDocs(query(collection(db, EMPS), orderBy('joined', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
}

export function subscribeEmployees(cb: (employees: Employee[]) => void) {
    return onSnapshot(
        query(collection(db, EMPS), orderBy('joined', 'asc')),
        (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)))
    );
}

export async function addEmployee(data: Omit<Employee, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, EMPS), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

/**
 * Create a new employee via the backend API.
 * The server uses Firebase Admin SDK to:
 *   1. Create a Firebase Auth user with the given email + password.
 *   2. Write `employees/{uid}` in Firestore.
 *   3. Write `userProfiles/{uid}` in Firestore (role = STAFF).
 *
 * The employee can then immediately log in with the provided credentials.
 */
export async function createEmployeeWithAuth(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    salaryPerDay: number;
    checkInTime: string;
    checkOutTime: string;
}): Promise<{ uid: string; message: string }> {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${apiBase}/api/create-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
        throw new Error(json.error || 'Failed to create employee.');
    }

    return json as { uid: string; message: string };
}

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
    await updateDoc(doc(db, EMPS, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEmployee(id: string): Promise<void> {
    await deleteDoc(doc(db, EMPS, id));
}

/**
 * Fetch the employee record whose Firestore document ID equals the
 * Firebase Auth UID.
 *
 * Structure: employees/{uid}  ← document ID IS the UID
 *
 * This is a direct O(1) getDoc — no collection scan, no index needed.
 *
 * @returns The Employee data, or null if no document exists for this UID.
 */
export async function fetchEmployeeByUid(uid: string): Promise<import('../types').Employee | null> {
    console.log('[fetchEmployeeByUid] Fetching employees/' + uid);

    const docRef = doc(db, EMPS, uid);          // direct doc reference by UID
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        console.warn('[fetchEmployeeByUid] No employee document found at employees/' + uid);
        return null;
    }

    const employee = { id: docSnap.id, ...docSnap.data() } as import('../types').Employee;
    console.log('[fetchEmployeeByUid] Found employee:', employee.name, '| doc ID:', employee.id);
    return employee;
}

// ── Upload photo to Storage and return download URL ───────────────────────────

export async function uploadPhoto(empId: string, dataUrl: string, type: 'profile' | 'selfie'): Promise<string> {
    const path = `${type}s/${empId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    return getDownloadURL(storageRef);
}

// ── Attendance ────────────────────────────────────────────────────────────────

const ATT = 'attendance';

/** Attendance records are stored with doc ID = `{empId}_{date}` for easy lookups */
function attDocId(empId: string, date: string) {
    return `${empId}_${date}`;
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
    const snap = await getDocs(query(collection(db, ATT), orderBy('date', 'desc')));
    return snap.docs.map(d => d.data() as AttendanceRecord);
}

export function subscribeAttendance(cb: (records: AttendanceRecord[]) => void) {
    return onSnapshot(
        query(collection(db, ATT), orderBy('date', 'desc')),
        (snap) => cb(snap.docs.map(d => d.data() as AttendanceRecord))
    );
}

/** Staff-only: subscribe to attendance records for only one employee */
export function subscribeOwnAttendance(empId: string, cb: (records: AttendanceRecord[]) => void) {
    return onSnapshot(
        query(collection(db, ATT), where('empId', '==', empId), orderBy('date', 'desc')),
        (snap) => cb(snap.docs.map(d => d.data() as AttendanceRecord))
    );
}

export async function checkIn(
    empId: string,
    date: string,
    time: string,
    selfie: string | null,
    gps: { lat: string; lng: string } | null
): Promise<void> {
    const id = attDocId(empId, date);
    await setDoc(doc(db, ATT, id), {
        empId, date, checkIn: time, checkOut: null, selfie, gps,
        createdAt: serverTimestamp(),
    }, { merge: true });
}

export async function checkOut(empId: string, date: string, time: string): Promise<void> {
    const id = attDocId(empId, date);
    await updateDoc(doc(db, ATT, id), { checkOut: time, updatedAt: serverTimestamp() });
}

// ── Staff Check-In / Check-Out (new structure) ────────────────────────────────
// Uses: employeeId = Firebase Auth UID, serverTimestamp() for times, totalHours field.
// Document ID: attendance/{employeeId}_{date}

/**
 * Staff Check-In
 * Creates (or merges) an attendance document for today:
 * {
 *   employeeId: uid,
 *   date: "YYYY-MM-DD",
 *   checkIn: serverTimestamp(),
 *   checkOut: null,
 *   totalHours: null
 * }
 */
export async function staffCheckIn(
    uid: string,
    date: string,
    location: { lat: number; lng: number } | null = null
): Promise<void> {
    console.log('[staffCheckIn] uid:', uid, 'date:', date, 'location:', location);
    const docId = `${uid}_${date}`;
    await setDoc(doc(db, ATT, docId), {
        employeeId: uid,
        date,
        checkIn: serverTimestamp(),
        checkOut: null,
        totalHours: null,
        location,
    }, { merge: true });
    console.log('[staffCheckIn] Document written:', docId);
}

/**
 * Staff Check-Out
 * Finds today's attendance record (employeeId == uid, checkOut == null) and updates it:
 * {
 *   checkOut: serverTimestamp(),
 *   totalHours: <computed from checkIn → checkOut>
 * }
 * totalHours is calculated client-side using the checkIn Timestamp seconds.
 */
export async function staffCheckOut(uid: string, date: string): Promise<void> {
    console.log('[staffCheckOut] uid:', uid, 'date:', date);
    const docId = `${uid}_${date}`;
    const docRef = doc(db, ATT, docId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        console.warn('[staffCheckOut] No attendance record for today. Check in first.');
        throw new Error('No check-in record found for today.');
    }

    const data = snap.data();
    if (data.checkOut) {
        console.warn('[staffCheckOut] Already checked out today.');
        throw new Error('Already checked out today.');
    }

    // Compute totalHours from Firestore Timestamp seconds
    const now = new Date();
    let totalHours: number | null = null;
    if (data.checkIn && typeof data.checkIn.toDate === 'function') {
        const checkInTime: Date = data.checkIn.toDate();
        const diffMs = now.getTime() - checkInTime.getTime();
        totalHours = Math.round((diffMs / 3_600_000) * 100) / 100; // 2 decimal places
        console.log('[staffCheckOut] totalHours calculated:', totalHours);
    }

    await updateDoc(docRef, {
        checkOut: serverTimestamp(),
        totalHours,
    });
    console.log('[staffCheckOut] Document updated:', docId);
}

/**
 * Real-time subscription to this staff member's own attendance records.
 * Queries: collection("attendance") WHERE employeeId == uid ORDER BY date DESC
 */
export function subscribeStaffAttendance(
    uid: string,
    cb: (records: import('../types').StaffAttendanceRecord[]) => void,
): () => void {
    console.log('[subscribeStaffAttendance] Subscribing for uid:', uid);
    return onSnapshot(
        query(collection(db, ATT), where('employeeId', '==', uid), orderBy('date', 'desc')),
        (snap) => {
            const records = snap.docs.map(d => d.data() as import('../types').StaffAttendanceRecord);
            console.log('[subscribeStaffAttendance] Records received:', records.length);
            cb(records);
        },
        (err) => {
            console.error('[subscribeStaffAttendance] Subscription error:', err);
        }
    );
}

