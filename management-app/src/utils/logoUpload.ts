import { supabase } from '../lib/supabase';

export const BUSINESS_LOGOS_BUCKET = 'business-logos';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type LogoEntityKind = 'winery' | 'wine_shop';

export function validateLogoFile(file: File): { ok: true } | { ok: false; message: string } {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: 'סוג קובץ לא נתמך. יש לבחור JPEG, PNG, WebP או GIF.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'הקובץ גדול מדי (מקסימום 2MB).' };
  }
  return { ok: true };
}

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpg' ? 'jpeg' : fromName;
  }
  if (file.type === 'image/jpeg') return 'jpeg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpeg';
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upload to public bucket; returns public URL saved in logo_url.
 */
export async function uploadBusinessLogo(
  file: File,
  kind: LogoEntityKind,
  entityId: number
): Promise<string> {
  const v = validateLogoFile(file);
  if (!v.ok) throw new Error(v.message);

  const folder = kind === 'winery' ? 'wineries' : 'wine_shops';
  const ext = extFromFile(file);
  const path = `${folder}/${entityId}/${Date.now()}-${randomId()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUSINESS_LOGOS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUSINESS_LOGOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Branded bottle image — stored in branded_bottles/...; URL saved in branded_bottle_img. */
export async function uploadBrandedBottleImg(
  file: File,
  kind: LogoEntityKind,
  entityId: number
): Promise<string> {
  const v = validateLogoFile(file);
  if (!v.ok) throw new Error(v.message);

  const folder = kind === 'winery' ? 'wineries' : 'wine_shops';
  const ext = extFromFile(file);
  const path = `branded-bottles/${folder}/${entityId}/${Date.now()}-${randomId()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUSINESS_LOGOS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUSINESS_LOGOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
