import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { WineryFeature } from '../data/wineries';

const STORAGE_KEY = 'wine_me_saved_places_v1';

export interface SavedPlace {
  id: string;
  placeId: string | null;
  name: string;
  address: string | null;
  region: string | null;
  lat: number;
  lng: number;
  isShop: boolean;
  savedAt: number;
  /** Optional: enriched when saving from map; older saved entries may omit these. */
  phone?: string | null;
  website?: string | null;
  kosher?: boolean | null;
  offers?: string | null;
  opening_hours?: string[] | string | null;
  logo_url?: string | null;
  logo_paid?: boolean | null;
  premium?: boolean | null;
  premium_expires_at?: string | null;
  branded_bottle_img?: string | null;
}

function roundCoord(n: number): string {
  return n.toFixed(4);
}

export function stableSavedId(feature: WineryFeature, isShop: boolean): string {
  const pid = feature.properties.place_id;
  if (pid) return `${isShop ? 's' : 'w'}:place:${pid}`;
  const [lng, lat] = feature.geometry.coordinates;
  const name = (feature.properties.name || '').trim().slice(0, 80);
  return `${isShop ? 's' : 'w'}:geo:${roundCoord(lat)}:${roundCoord(lng)}:${name}`;
}

export function toSavedPlace(feature: WineryFeature, isShop: boolean): SavedPlace {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    id: stableSavedId(feature, isShop),
    placeId: feature.properties.place_id,
    name: feature.properties.name || '',
    address: feature.properties.address,
    region: feature.properties.region,
    lat,
    lng,
    isShop,
    savedAt: Date.now(),
    phone: feature.properties.phone ?? null,
    website: feature.properties.website ?? null,
    kosher: feature.properties.kosher ?? null,
    offers: feature.properties.offers ?? null,
    opening_hours: feature.properties.opening_hours ?? null,
    logo_url: feature.properties.logo_url ?? null,
    logo_paid: feature.properties.logo_paid ?? null,
    premium: feature.properties.premium ?? null,
    premium_expires_at: feature.properties.premium_expires_at ?? null,
    branded_bottle_img: feature.properties.branded_bottle_img ?? null,
  };
}

function normalizeStoredOpeningHours(
  raw: SavedPlace['opening_hours']
): WineryFeature['properties']['opening_hours'] {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
      return [String(parsed)];
    } catch {
      return [raw];
    }
  }
  return null;
}

/** Rebuild a GeoJSON feature for list-card UI (saved bookmarks). */
export function savedPlaceToFeature(place: SavedPlace): WineryFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
    properties: {
      name: place.name || '',
      address: place.address ?? null,
      place_id: place.placeId ?? null,
      region: place.region ?? null,
      kosher: place.kosher ?? null,
      phone: place.phone ?? null,
      website: place.website ?? null,
      opening_hours: normalizeStoredOpeningHours(place.opening_hours),
      is_open: null,
      offers: place.offers ?? null,
      logo_url: place.logo_url ?? null,
      logo_paid: place.logo_paid ?? null,
      premium: place.premium ?? null,
      premium_expires_at: place.premium_expires_at ?? null,
      branded_bottle_img: place.branded_bottle_img ?? null,
    },
  };
}

interface SavedPlacesContextValue {
  items: SavedPlace[];
  isSaved: (feature: WineryFeature, isShop: boolean) => boolean;
  toggleSave: (feature: WineryFeature, isShop: boolean) => void;
  removeSaved: (id: string) => void;
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | undefined>(undefined);

function loadInitial(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlace[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        typeof p.isShop === 'boolean'
    );
  } catch {
    return [];
  }
}

export const SavedPlacesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<SavedPlace[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota */
    }
  }, [items]);

  const isSaved = useCallback(
    (feature: WineryFeature, isShop: boolean) => {
      const id = stableSavedId(feature, isShop);
      return items.some((p) => p.id === id);
    },
    [items]
  );

  const removeSaved = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleSave = useCallback((feature: WineryFeature, isShop: boolean) => {
    const id = stableSavedId(feature, isShop);
    setItems((prev) => {
      const exists = prev.some((p) => p.id === id);
      if (exists) return prev.filter((p) => p.id !== id);
      const next = toSavedPlace(feature, isShop);
      return [next, ...prev];
    });
  }, []);

  const value = useMemo(
    () => ({ items, isSaved, toggleSave, removeSaved }),
    [items, isSaved, toggleSave, removeSaved]
  );

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
};

export function useSavedPlaces(): SavedPlacesContextValue {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) {
    throw new Error('useSavedPlaces must be used within SavedPlacesProvider');
  }
  return ctx;
}
