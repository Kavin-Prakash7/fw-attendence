// ─── Firebase Configuration ───────────────────────────────────────────────────
// Replace these values with your actual Firebase project credentials.
// Create a project at https://console.firebase.google.com
// Enable: Authentication (Email/Password), Firestore Database, Storage
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAySNwAv1S-b6G4ZHzGP2kg1GNPbhtqSmM",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fw-attendence.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fw-attendence",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fw-attendence.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "992963197754",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:992963197754:web:bc0f646fd0198a3445ae03",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
