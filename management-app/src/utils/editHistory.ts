import { supabase } from '../lib/supabase';
import type { WineShop, Winery } from '../lib/supabase';

export type EditEntityType = 'winery' | 'wine_shop';

export interface ManagementEditRow {
  id: string;
  entity_type: EditEntityType;
  entity_id: number;
  column_key: string;
  edited_at: string;
  editor_id: string | null;
}

const WINERY_KEYS: (keyof Winery)[] = [
  'name',
  'address',
  'place_id',
  'region',
  'kosher',
  'phone',
  'website',
  'opening_hours',
  'is_open',
  'lat',
  'lng',
  'offers',
  'promotion_image_urls',
  'logo_url',
  'branded_bottle_img',
  'logo_paid',
  'premium',
  'premium_expires_at',
];

const SHOP_KEYS: (keyof WineShop)[] = [...WINERY_KEYS];

export const columnLabelHe: Record<string, string> = {
  name: 'שם',
  address: 'כתובת',
  place_id: 'מזהה מקום',
  region: 'אזור',
  kosher: 'כשרות',
  phone: 'טלפון',
  website: 'אתר',
  opening_hours: 'שעות פתיחה',
  is_open: 'פתוח כעת',
  lat: 'קו רוחב',
  lng: 'קו אורך',
  offers: 'מבצעים',
  promotion_image_urls: 'תמונות מבצע',
  logo_url: 'שינוי תמונת לוגו',
  branded_bottle_img: 'בקבוק ממותג',
  logo_paid: 'לוגו שולם',
  premium: 'פרימיום',
  premium_expires_at: 'תאריך סיום פרימיום',
};

function serializeField(_key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

function pickComparable(
  row: Partial<Winery | WineShop>,
  keys: (keyof Winery)[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = row[k as keyof typeof row];
    out[String(k)] = serializeField(String(k), v);
  }
  return out;
}

export function getChangedColumnKeys(
  before: Partial<Winery | WineShop> | null,
  after: Partial<Winery | WineShop>,
  keys: (keyof Winery)[]
): string[] {
  const prev = before ? pickComparable(before, keys) : {};
  const next = pickComparable(after, keys);
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of allKeys) {
    if (prev[k] !== next[k]) changed.push(k);
  }
  return changed;
}

export async function insertManagementEditHistory(
  entityType: EditEntityType,
  entityId: number,
  columnKeys: string[]
): Promise<void> {
  if (columnKeys.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const editorId = user?.id ?? null;
  const rows = columnKeys.map((column_key) => ({
    entity_type: entityType,
    entity_id: entityId,
    column_key,
    editor_id: editorId,
  }));
  const { error } = await supabase.from('management_edit_history').insert(rows);
  if (error) {
    console.error('management_edit_history insert:', error);
    throw error;
  }
}

export async function deleteManagementEditHistoryForEntity(
  entityType: EditEntityType,
  entityId: number
): Promise<void> {
  await supabase
    .from('management_edit_history')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
}

/** Latest edit timestamp per column for many entities (client-side max). */
export async function fetchLatestEditByColumn(
  entityType: EditEntityType,
  entityIds: number[]
): Promise<Record<number, Record<string, string>>> {
  const map: Record<number, Record<string, string>> = {};
  if (entityIds.length === 0) return map;
  const { data, error } = await supabase
    .from('management_edit_history')
    .select('entity_id, column_key, edited_at')
    .eq('entity_type', entityType)
    .in('entity_id', entityIds);
  if (error) {
    console.warn('fetchLatestEditByColumn:', error.message);
    return map;
  }
  for (const row of data || []) {
    const eid = row.entity_id as number;
    const key = row.column_key as string;
    const at = row.edited_at as string;
    if (!map[eid]) map[eid] = {};
    const prev = map[eid][key];
    if (!prev || new Date(at).getTime() > new Date(prev).getTime()) {
      map[eid][key] = at;
    }
  }
  return map;
}

export async function fetchEditHistoryForEntity(
  entityType: EditEntityType,
  entityId: number
): Promise<ManagementEditRow[]> {
  const { data, error } = await supabase
    .from('management_edit_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('edited_at', { ascending: false });
  if (error) {
    console.warn('fetchEditHistoryForEntity:', error.message);
    return [];
  }
  return (data || []) as ManagementEditRow[];
}

export function formatEditDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
}

export function getRowLastEditIso(
  columnMap: Record<string, string> | undefined
): string | null {
  if (!columnMap) return null;
  let best: string | null = null;
  let bestT = 0;
  for (const iso of Object.values(columnMap)) {
    const t = new Date(iso).getTime();
    if (t > bestT) {
      bestT = t;
      best = iso;
    }
  }
  return best;
}

export const wineryTrackedKeys = WINERY_KEYS;
export const wineShopTrackedKeys = SHOP_KEYS;
