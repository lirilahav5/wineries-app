export type PremiumDurationUnit = 'days' | 'months' | 'years';

/** Today at local midnight as yyyy-mm-dd */
export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add duration starting from today (local midnight) → yyyy-mm-dd */
export function addDurationFromToday(amount: number, unit: PremiumDurationUnit): string {
  if (!Number.isFinite(amount) || amount <= 0) return todayYmd();
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (unit === 'days') d.setDate(d.getDate() + amount);
  else if (unit === 'months') d.setMonth(d.getMonth() + amount);
  else d.setFullYear(d.getFullYear() + amount);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Full days from today (local) to expiry date (inclusive of end day as calendar difference). */
export function calendarDaysUntil(expiresAtYmd: string | null | undefined): number | null {
  if (!expiresAtYmd) return null;
  const parts = expiresAtYmd.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const mo = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  const end = new Date(y, mo, d);
  end.setHours(0, 0, 0, 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/** Green path: more than 5 days left. Red if ≤5 days (including expiry day / overdue). */
export function premiumExpiryIsUrgent(daysLeft: number | null): boolean {
  if (daysLeft === null) return false;
  return daysLeft <= 5;
}

export function formatYmdToDisplay(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
