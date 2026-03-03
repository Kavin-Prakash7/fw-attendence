// ─── Employees Page ───────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { todayKey, getInitials } from '../utils/helpers';
import type { Employee, AttendanceRecord } from '../types';

interface Props {
    employees: Employee[];
    attendance: AttendanceRecord[];
    onAdd: (form: Omit<Employee, 'id' | 'joined'>) => Promise<void>;
    onEdit: (id: string, form: Partial<Employee>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export default function Employees({ employees, attendance, onAdd, onEdit, onDelete }: Props) {
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', role: '', photo: '' });
    const [saving, setSaving] = useState(false);
    const today = todayKey();

    const filtered = employees.filter(
        (e) =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.role.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = useCallback(() => { setEditing(null); setForm({ name: '', role: '', photo: '' }); setShowModal(true); }, []);
    const openEdit = useCallback((emp: Employee) => {
        setEditing(emp.id);
        setForm({ name: emp.name, role: emp.role, photo: emp.photo || '' });
        setShowModal(true);
    }, []);

    async function handleSave() {
        if (!form.name.trim() || !form.role.trim()) return;
        setSaving(true);
        try {
            if (editing) await onEdit(editing, form);
            else await onAdd(form);
            setShowModal(false);
        } finally {
            setSaving(false);
        }
    }

    function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setForm((f) => ({ ...f, photo: ev.target?.result as string }));
        reader.readAsDataURL(file);
    }

    return (
        <div>
            <div className="toolbar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-input"
                        placeholder="Search employees..."
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
                                <div className="emp-id">{emp.id}</div>
                                <div className="emp-actions">
                                    <button className="btn-ghost" style={{ flex: 1 }} onClick={() => openEdit(emp)}>✏ Edit</button>
                                    <button className="btn-danger" onClick={() => onDelete(emp.id)}>🗑</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <div className="modal-title">{editing ? 'EDIT EMPLOYEE' : 'ADD EMPLOYEE'}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <label className={`photo-upload-area ${form.photo ? 'has-photo' : ''}`}>
                            {form.photo ? (
                                <img src={form.photo} alt="preview" className="photo-preview" />
                            ) : (
                                <>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                                    <div style={{ color: 'var(--text2)', fontSize: 14 }}>Click to upload photo</div>
                                    <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>JPG, PNG supported</div>
                                </>
                            )}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                        </label>

                        <div className="form-group" style={{ marginTop: 16 }}>
                            <label className="form-label">FULL NAME</label>
                            <input
                                className="form-input"
                                placeholder="e.g. John Doe"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ROLE / POSITION</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Photographer"
                                value={form.role}
                                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                            />
                        </div>

                        <div className="modal-footer">
                            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-accent" onClick={handleSave} disabled={saving}>
                                {saving ? <span className="spinner" /> : editing ? 'SAVE CHANGES' : 'ADD EMPLOYEE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
