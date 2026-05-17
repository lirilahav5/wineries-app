/** Today at local midnight as yyyy-mm-dd */
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Active premium: flag true and not past optional expiry (inclusive of expiry day). */
export function isPremiumActive(
  premium: boolean | null | undefined,
  premiumExpiresAt: string | null | undefined
): boolean {
  if (premium !== true) return false;
  if (premiumExpiresAt == null || String(premiumExpiresAt).trim() === '') return true;
  return String(premiumExpiresAt).slice(0, 10) >= todayYmd();
}
