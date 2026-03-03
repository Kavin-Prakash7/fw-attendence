// ─── Firebase Service Layer ───────────────────────────────────────────────────
// All Firestore and Auth calls go here, keeping components clean.
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, query, orderBy, onSnapshot, setDoc, serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import {
    signInWithEmailAndPassword, signOut as firebaseSignOut,
    onAuthStateChanged, User as FirebaseUser,
} from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './config';
import type { Employee, AttendanceRecord } from '../types';

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

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
    await updateDoc(doc(db, EMPS, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEmployee(id: string): Promise<void> {
    await deleteDoc(doc(db, EMPS, id));
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
