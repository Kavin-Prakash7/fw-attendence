// ─── Salary & Analytics Utilities ────────────────────────────────────────────

import type { Employee, AttendanceRecord, StaffAttendanceRecord } from '../types';

// ─── Type helpers ─────────────────────────────────────────────────────────────

/** Returns milliseconds from a Firestore Timestamp or a "HH:MM" string on a given date */
function toMs(date: string | undefined, val: unknown): number {
    if (!val || !date) return 0;
    if (typeof (val as any)?.toMillis === 'function') return (val as any).toMillis();
    if (typeof (val as any)?.toDate === 'function') return (val as any).toDate().getTime();
    if (typeof val === 'string' && val.length > 0) {
        const d = new Date(`${date} ${val}`);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
}

// ─── Per-employee salary summary ──────────────────────────────────────────────

export interface EmployeeSalarySummary {
    id: string;
    name: string;
    role: string;
    salaryPerDay: number;
    daysPresent: number;
    totalHours: number;   // across all records
    monthlySalary: number;
}

/**
 * Calculate monthly salary for every employee.
 * Considers both old (empId) and new (employeeId) attendance record shapes.
 */
export function calcSalaries(
    employees: Employee[],
    attendance: (AttendanceRecord | StaffAttendanceRecord)[],
    month: Date = new Date(),
): EmployeeSalarySummary[] {
    const m = month.getMonth();
    const y = month.getFullYear();

    return employees.map((emp) => {
        // Match records for this employee by either id field
        const empRecs = attendance.filter((r: any) => {
            const matchId = r.employeeId === emp.id || r.empId === emp.id;
            if (!matchId) return false;
            const d = new Date(r.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });

        const daysPresent = empRecs.filter((r: any) => r.checkIn).length;

        // Sum up hours — handle totalHours field (staff) or compute from timestamps
        const totalHours = empRecs.reduce((sum, r: any) => {
            if (typeof r.totalHours === 'number') return sum + r.totalHours;
            const inMs = toMs(r.date, r.checkIn);
            const outMs = toMs(r.date, r.checkOut);
            if (!inMs || !outMs || outMs <= inMs) return sum;
            return sum + (outMs - inMs) / 3_600_000;
        }, 0);

        const salaryPerDay = emp.salaryPerDay ?? 0;
        const monthlySalary = daysPresent * salaryPerDay;

        return {
            id: emp.id,
            name: emp.name,
            role: emp.role,
            salaryPerDay,
            daysPresent,
            totalHours: Math.round(totalHours * 10) / 10,
            monthlySalary,
        };
    });
}

// ─── Chart data generators ────────────────────────────────────────────────────

export interface DailyAttendancePoint {
    date: string;       // "Mon", "Tue", …
    fullDate: string;   // "2025-03-06"
    present: number;
    absent: number;
}

/** Last N days daily attendance count */
export function getDailyAttendanceData(
    attendance: AttendanceRecord[],
    employees: Employee[],
    days = 7,
): DailyAttendancePoint[] {
    const result: DailyAttendancePoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const dayRecs = attendance.filter((r) => r.date === key);
        const present = dayRecs.filter((r) => r.checkIn).length;
        result.push({
            date: d.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: key,
            present,
            absent: Math.max(0, employees.length - present),
        });
    }
    return result;
}

export interface WeeklyHoursPoint {
    week: string;   // "W1", "W2", …
    hours: number;
}

/** Weekly hours for the last 4 weeks */
export function getWeeklyHoursData(
    attendance: (AttendanceRecord | StaffAttendanceRecord)[],
    weeks = 4,
): WeeklyHoursPoint[] {
    const result: WeeklyHoursPoint[] = [];
    const now = new Date();
    for (let w = weeks - 1; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - (w + 1) * 7);
        const end = new Date(now);
        end.setDate(now.getDate() - w * 7);

        const hours = attendance
            .filter((r: any) => {
                const d = new Date(r.date);
                return d >= start && d < end;
            })
            .reduce((sum, r: any) => {
                if (typeof r.totalHours === 'number') return sum + r.totalHours;
                const inMs = toMs(r.date, r.checkIn);
                const outMs = toMs(r.date, r.checkOut);
                if (!inMs || !outMs || outMs <= inMs) return sum;
                return sum + (outMs - inMs) / 3_600_000;
            }, 0);

        result.push({ week: `W${weeks - w}`, hours: Math.round(hours * 10) / 10 });
    }
    return result;
}

export interface TopEmployeePoint {
    name: string;
    hours: number;
}

/** Top N employees by hours this month */
export function getTopEmployeesByHours(
    salaries: EmployeeSalarySummary[],
    top = 5,
): TopEmployeePoint[] {
    return [...salaries]
        .sort((a, b) => b.totalHours - a.totalHours)
        .slice(0, top)
        .map((s) => ({ name: s.name.split(' ')[0], hours: s.totalHours }));
}

export interface MonthlyAttendancePoint {
    month: string;
    days: number;
}

/** Monthly attendance count (distinct employee-day pairs) for past N months */
export function getMonthlyAttendanceData(
    attendance: AttendanceRecord[],
    months = 6,
): MonthlyAttendancePoint[] {
    const result: MonthlyAttendancePoint[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        const days = attendance.filter((r) => {
            const rd = new Date(r.date);
            return rd.getMonth() === m && rd.getFullYear() === y && r.checkIn;
        }).length;
        result.push({
            month: d.toLocaleDateString('en-US', { month: 'short' }),
            days,
        });
    }
    return result;
}
