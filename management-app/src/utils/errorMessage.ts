/**
 * Supabase PostgrestError / StorageError are plain objects with `message`, not always `instanceof Error`.
 */
export function getErrorMessage(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === 'string' && o.message.trim()) parts.push(o.message.trim());
    if (typeof o.details === 'string' && o.details.trim()) parts.push(o.details.trim());
    if (typeof o.hint === 'string' && o.hint.trim()) parts.push(o.hint.trim());
    if (typeof o.code === 'string' && o.code.trim()) parts.push(`[${o.code}]`);
    if (parts.length > 0) return parts.join(' — ');
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
