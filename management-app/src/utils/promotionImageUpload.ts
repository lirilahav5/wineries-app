import { supabase } from '../lib/supabase';
import { BUSINESS_LOGOS_BUCKET, validateLogoFile, type LogoEntityKind } from './logoUpload';

export function normalizePromotionImageUrls(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  return [];
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
 * Upload one promotion image to the public business-logos bucket under promotions/.
 */
export async function uploadPromotionImage(
  file: File,
  kind: LogoEntityKind,
  entityId: number
): Promise<string> {
  const v = validateLogoFile(file);
  if (!v.ok) throw new Error(v.message);

  const folder = kind === 'winery' ? 'wineries' : 'wine_shops';
  const ext = extFromFile(file);
  const path = `promotions/${folder}/${entityId}/${Date.now()}-${randomId()}.${ext}`;

  const { error } = await supabase.storage.from(BUSINESS_LOGOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUSINESS_LOGOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPromotionImages(
  files: File[],
  kind: LogoEntityKind,
  entityId: number
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadPromotionImage(file, kind, entityId));
  }
  return urls;
}
