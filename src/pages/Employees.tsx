// ─── Employees Page ───────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { todayKey, getInitials } from '../utils/helpers';
import { createEmployeeWithAuth } from '../firebase/services';
import type { Employee, AttendanceRecord } from '../types';

interface AddForm {
    name: string;
    email: string;
    password: string;
    role: string;
    salaryPerDay: string;
    checkInTime: string;
    checkOutTime: string;
}

interface EditForm {
    name: string;
    role: string;
    photo: string;
    salaryPerDay: string;
    checkInTime: string;
    checkOutTime: string;
}

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
    onAdd: (form: Omit<Employee, 'id' | 'joined'>) => Promise<void>;
    onEdit: (id: string, form: Partial<Employee>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_ADD: AddForm = {
    name: '',
    email: '',
    password: '',
    role: '',
    salaryPerDay: '',
    checkInTime: '09:00',
    checkOutTime: '18:00',
};

const DEFAULT_EDIT: EditForm = {
    name: '',
    role: '',
    photo: '',
    salaryPerDay: '',
    checkInTime: '09:00',
    checkOutTime: '18:00',
};

export default function Employees({ employees, attendance, onAdd, onEdit, onDelete, showToast }: Props) {
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [addForm, setAddForm] = useState<AddForm>(DEFAULT_ADD);
    const [editForm, setEditForm] = useState<EditForm>(DEFAULT_EDIT);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [showPass, setShowPass] = useState(false);
    const today = todayKey();

    const filtered = employees.filter(
        (e) =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.role.toLowerCase().includes(search.toLowerCase()) ||
            (e.email ?? '').toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = useCallback(() => {
        setEditing(null);
        setAddForm(DEFAULT_ADD);
        setFormError('');
        setShowPass(false);
        setShowModal(true);
    }, []);

    const openEdit = useCallback((emp: Employee) => {
        setEditing(emp.id);
        setEditForm({
            name: emp.name,
            role: emp.role,
            photo: emp.photo || '',
            salaryPerDay: emp.salaryPerDay != null ? String(emp.salaryPerDay) : '',
            checkInTime: emp.checkInTime || '09:00',
            checkOutTime: emp.checkOutTime || '18:00',
        });
        setFormError('');
        setShowModal(true);
    }, []);

    async function handleSave() {
        setFormError('');

        if (editing) {
            // ── EDIT MODE ─────────────────────────────────────────────────────
            if (!editForm.name.trim() || !editForm.role.trim()) {
                setFormError('Name and Role are required.');
                return;
            }
            setSaving(true);
            try {
                await onEdit(editing, {
                    name: editForm.name.trim(),
                    role: editForm.role.trim(),
                    photo: editForm.photo,
                    salaryPerDay: editForm.salaryPerDay ? parseFloat(editForm.salaryPerDay) : undefined,
                    checkInTime: editForm.checkInTime || undefined,
                    checkOutTime: editForm.checkOutTime || undefined,
                });
                setShowModal(false);
            } catch (err: any) {
                setFormError(err.message || 'Failed to update employee.');
            } finally {
                setSaving(false);
            }
        } else {
            // ── ADD MODE (create Firebase Auth user via backend) ───────────────
            const { name, email, password, role, salaryPerDay, checkInTime, checkOutTime } = addForm;
            if (!name.trim()) { setFormError('Name is required.'); return; }
            if (!email.trim()) { setFormError('Email is required.'); return; }
            if (!password.trim() || password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
            if (!role.trim()) { setFormError('Role / Position is required.'); return; }

            setSaving(true);
            try {
                await createEmployeeWithAuth({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    password,
                    role: role.trim(),
                    salaryPerDay: salaryPerDay ? parseFloat(salaryPerDay) : 0,
                    checkInTime: checkInTime || '09:00',
                    checkOutTime: checkOutTime || '18:00',
                });
                showToast?.(`${name.trim()} added successfully!`, 'success');
                setShowModal(false);
            } catch (err: any) {
                setFormError(err.message || 'Failed to create employee.');
            } finally {
                setSaving(false);
            }
        }
    }

    function handleEditPhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setEditForm((f) => ({ ...f, photo: ev.target?.result as string }));
        reader.readAsDataURL(file);
    }

    return (
        <div>
            <div className="toolbar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-input"
                        placeholder="Search by name, role or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button className="btn-accent" onClick={openAdd}>+ ADD EMPLOYEE</button>
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">👤</div>
                    No employees found.
                </div>
            ) : (
                <div className="emp-grid">
                    {filtered.map((emp) => {
                        const todayRec = attendance.find((r) => r.empId === emp.id && r.date === today);
                        const isPresent = !!(todayRec?.checkIn);
                        return (
                            <div key={emp.id} className="emp-card">
                                <div className="emp-photo">
                                    {emp.photo ? <img src={emp.photo} alt={emp.name} /> : getInitials(emp.name)}
                                    <div className={`emp-status-dot ${isPresent ? 'status-present' : 'status-absent'}`} />
                                </div>
                                <div className="emp-name">{emp.name}</div>
                                <div className="emp-role">{emp.role}</div>
                                {emp.email && (
                                    <div className="emp-id" style={{ fontSize: 11 }}>{emp.email}</div>
                                )}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
                                    {emp.salaryPerDay != null && emp.salaryPerDay > 0 && (
                                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                            💰 ₹{emp.salaryPerDay}/day
                                        </div>
                                    )}
                                    {emp.checkInTime && (
                                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                            🕘 {emp.checkInTime}–{emp.checkOutTime ?? '--'}
                                        </div>
                                    )}
                                </div>
                                <div className="emp-actions">
                                    <button className="btn-ghost" style={{ flex: 1 }} onClick={() => openEdit(emp)}>✏ Edit</button>
                                    <button className="btn-danger" onClick={() => onDelete(emp.id)}>🗑</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODAL ── */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520, width: '100%' }}>
                        <div className="modal-header">
                            <div className="modal-title">{editing ? 'EDIT EMPLOYEE' : 'ADD EMPLOYEE'}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        {formError && (
                            <div style={{
                                margin: '0 0 12px',
                                padding: '10px 14px',
                                background: 'rgba(239,68,68,0.12)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: 8,
                                color: '#fca5a5',
                                fontSize: 13,
                            }}>
                                ⚠ {formError}
                            </div>
                        )}

                        {editing ? (
                            /* ── EDIT FORM ── */
                            <>
                                <label className={`photo-upload-area ${editForm.photo ? 'has-photo' : ''}`}>
                                    {editForm.photo ? (
                                        <img src={editForm.photo} alt="preview" className="photo-preview" />
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                                            <div style={{ color: 'var(--text2)', fontSize: 14 }}>Click to upload photo</div>
                                            <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>JPG, PNG supported</div>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhoto} />
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">FULL NAME</label>
                                        <input className="form-input" placeholder="e.g. John Doe" value={editForm.name}
                                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">ROLE / POSITION</label>
                                        <input className="form-input" placeholder="e.g. Photographer" value={editForm.role}
                                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">SALARY PER DAY (₹)</label>
                                        <input className="form-input" type="number" min="0" placeholder="e.g. 1500" value={editForm.salaryPerDay}
                                            onChange={(e) => setEditForm((f) => ({ ...f, salaryPerDay: e.target.value }))} />
                                    </div>
                                    <div className="form-group" />
                                    <div className="form-group">
                                        <label className="form-label">CHECK-IN TIME</label>
                                        <input className="form-input" type="time" value={editForm.checkInTime}
                                            onChange={(e) => setEditForm((f) => ({ ...f, checkInTime: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">CHECK-OUT TIME</label>
                                        <input className="form-input" type="time" value={editForm.checkOutTime}
                                            onChange={(e) => setEditForm((f) => ({ ...f, checkOutTime: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* ── ADD FORM ── */
                            <>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                                    background: 'rgba(255,120,30,0.08)', border: '1px solid rgba(255,120,30,0.2)',
                                    fontSize: 12, color: 'var(--text2)',
                                }}>
                                    🔐 A Firebase login account will be created automatically with the email &amp; password you enter.
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {/* Name — full width */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">FULL NAME *</label>
                                        <input id="emp-name" className="form-input" placeholder="e.g. John Doe" value={addForm.name}
                                            onChange={(e) => { setFormError(''); setAddForm((f) => ({ ...f, name: e.target.value })); }} />
                                    </div>

                                    {/* Email — full width */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">EMAIL ADDRESS *</label>
                                        <input id="emp-email" className="form-input" type="email" placeholder="e.g. john@fotoworld.com"
                                            value={addForm.email}
                                            onChange={(e) => { setFormError(''); setAddForm((f) => ({ ...f, email: e.target.value })); }} />
                                    </div>

                                    {/* Password — full width */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                                        <label className="form-label">PASSWORD * (min 6 chars)</label>
                                        <input id="emp-password" className="form-input" type={showPass ? 'text' : 'password'}
                                            placeholder="••••••••" value={addForm.password}
                                            style={{ paddingRight: 44 }}
                                            onChange={(e) => { setFormError(''); setAddForm((f) => ({ ...f, password: e.target.value })); }} />
                                        <button type="button" onClick={() => setShowPass((v) => !v)}
                                            style={{
                                                position: 'absolute', right: 12, bottom: 10,
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--text3)', fontSize: 16, padding: 0,
                                            }}>
                                            {showPass ? '🙈' : '👁'}
                                        </button>
                                    </div>

                                    {/* Role — full width */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">ROLE / POSITION *</label>
                                        <input id="emp-role" className="form-input" placeholder="e.g. Photographer"
                                            value={addForm.role}
                                            onChange={(e) => { setFormError(''); setAddForm((f) => ({ ...f, role: e.target.value })); }} />
                                    </div>

                                    {/* Salary */}
                                    <div className="form-group">
                                        <label className="form-label">SALARY PER DAY (₹)</label>
                                        <input id="emp-salary" className="form-input" type="number" min="0" placeholder="e.g. 1500"
                                            value={addForm.salaryPerDay}
                                            onChange={(e) => setAddForm((f) => ({ ...f, salaryPerDay: e.target.value }))} />
                                    </div>

                                    {/* Spacer */}
                                    <div className="form-group" />

                                    {/* Check-in time */}
                                    <div className="form-group">
                                        <label className="form-label">CHECK-IN TIME</label>
                                        <input id="emp-checkin" className="form-input" type="time" value={addForm.checkInTime}
                                            onChange={(e) => setAddForm((f) => ({ ...f, checkInTime: e.target.value }))} />
                                    </div>

                                    {/* Check-out time */}
                                    <div className="form-group">
                                        <label className="form-label">CHECK-OUT TIME</label>
                                        <input id="emp-checkout" className="form-input" type="time" value={addForm.checkOutTime}
                                            onChange={(e) => setAddForm((f) => ({ ...f, checkOutTime: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="modal-footer">
                            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-accent" onClick={handleSave} disabled={saving}>
                                {saving
                                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 8 }} />Creating…</>
                                    : editing ? 'SAVE CHANGES' : 'CREATE EMPLOYEE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
