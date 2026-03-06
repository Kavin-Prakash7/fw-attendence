import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Load environment variables (from .env or .env.local)
dotenv.config();
dotenv.config({ path: '.env.local' });

// ── Firebase Admin SDK Initialization ────────────────────────────────────────
// Supports two modes:
//  1. FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string of service account key)
//  2. Application Default Credentials (gcloud auth / Cloud Run / etc.)
function initAdminSDK() {
    if (getApps().length > 0) return; // already initialized
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            initializeApp({ credential: cert(serviceAccount) });
            console.log('[Admin SDK] Initialized with service account.');
        } catch (e) {
            console.error('[Admin SDK] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        }
    } else {
        // Fallback: initialize with projectId only (read-only metadata ops, limited)
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'fw-attendence';
        initializeApp({ projectId });
        console.warn('[Admin SDK] No FIREBASE_SERVICE_ACCOUNT_JSON set. User creation requires a service account.');
    }
}
initAdminSDK();

const app = express();
app.use(cors());
app.use(express.json());

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Backend API server running on port ${port}`);
});

app.post('/api/chat', async (req, res) => {
    try {
        const { system, messages, model, max_tokens } = req.body;

        // Ensure you have ANTHROPIC_API_KEY set in your .env
        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

        if (!apiKey) {
            console.error('Missing Anthropic API key.');
            return res.status(500).json({ error: 'Missing Anthropic API key in server config.' });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model || 'claude-3-haiku-20240307',
                max_tokens: max_tokens || 400,
                system: system,
                messages: messages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic API error:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Error calling Anthropic API:', error);
        res.status(500).json({ error: 'Internal server error while calling AI.' });
    }
});

// ── Create Employee Endpoint ──────────────────────────────────────────────────
// POST /api/create-employee
// Body: { name, email, password, role, salaryPerDay, checkInTime, checkOutTime }
// 1. Creates Firebase Auth user
// 2. Writes employees/{uid} in Firestore
// 3. Writes userProfiles/{uid} in Firestore
app.post('/api/create-employee', async (req, res) => {
    try {
        const { name, email, password, role, salaryPerDay, checkInTime, checkOutTime } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'name, email, and password are required.' });
        }

        // Step 1: Create Firebase Auth user
        const adminAuth = getAuth();
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({
                email,
                password,
                displayName: name,
            });
        } catch (authErr) {
            console.error('[create-employee] Auth error:', authErr.message);
            if (authErr.code === 'auth/email-already-exists') {
                return res.status(409).json({ error: 'An account with this email already exists.' });
            }
            return res.status(400).json({ error: authErr.message || 'Failed to create auth user.' });
        }

        const uid = userRecord.uid;
        console.log('[create-employee] Auth user created, UID:', uid);

        // Step 2 & 3: Write Firestore documents
        const adminDb = getFirestore();
        const now = FieldValue.serverTimestamp();
        const joined = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const employeeData = {
            uid,
            name,
            email,
            role: role || 'Photographer',
            salaryPerDay: parseFloat(salaryPerDay) || 0,
            checkInTime: checkInTime || '09:00',
            checkOutTime: checkOutTime || '18:00',
            photo: '',
            joined,
            createdAt: now,
        };

        const userProfileData = {
            uid,
            email,
            name,
            role: 'STAFF',
            empId: uid,
            createdAt: now,
        };

        await adminDb.doc(`employees/${uid}`).set(employeeData);
        await adminDb.doc(`userProfiles/${uid}`).set(userProfileData);

        console.log('[create-employee] Firestore docs written for UID:', uid);

        res.status(201).json({
            success: true,
            uid,
            message: `Employee "${name}" created successfully.`,
        });
    } catch (error) {
        console.error('[create-employee] Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
