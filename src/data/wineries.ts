import { supabase } from '../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

interface WineryRow {
  name: string;
  address: string | null;
  place_id: string | null;
  region: string | null;
  kosher: boolean | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | string[] | null;
  is_open: boolean | null;
  offers: string | null;
  lng: string | number | null;
  lat: string | number | null;
  logo_url: string | null;
  logo_paid: boolean | null;
  premium?: boolean | null;
  premium_expires_at?: string | null;
  branded_bottle_img?: string | null;
}

export interface WineryProperties {
  name: string;
  address: string | null;
  place_id: string | null;
  region: string | null;
  kosher: boolean | null;
  phone: string | null;
  website: string | null;
  opening_hours: string[] | null;
  is_open: boolean | null;
  offers: string | null;
  logo_url: string | null;
  logo_paid: boolean | null;
  premium?: boolean | null;
  premium_expires_at?: string | null;
  branded_bottle_img?: string | null;
}

export type WineryFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: WineryProperties;
};

function createFeature(row: WineryRow): WineryFeature | null {
  // Handle both string and number types for lat/lng
  const lng = typeof row.lng === 'number' ? row.lng : parseFloat(row.lng || '');
  const lat = typeof row.lat === 'number' ? row.lat : parseFloat(row.lat || '');
  
  if (isNaN(lng) || isNaN(lat) || !lng || !lat) {
    console.warn(`Location ${row.name} is missing coordinates`, { lng, lat, row });
    return null;
  }
  
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [lng, lat] as [number, number]
    },
    properties: {
      name: row.name || 'Unnamed Location',
      address: row.address,
      place_id: row.place_id,
      region: row.region,
      kosher: row.kosher,
      phone: row.phone,
      website: row.website,
      opening_hours: typeof row.opening_hours === 'string' 
        ? JSON.parse(row.opening_hours) 
        : row.opening_hours,
      is_open: row.is_open,
      offers: row.offers,
      logo_url: row.logo_url,
      logo_paid: row.logo_paid,
      premium: row.premium ?? null,
      premium_expires_at: row.premium_expires_at ?? null,
      branded_bottle_img: row.branded_bottle_img ?? null,
    }
  };
}

export async function fetchWineriesFromDb(): Promise<{ type: 'FeatureCollection'; features: WineryFeature[] }> {
  try {
    console.log('Fetching wineries from Supabase...');
    
    // First, let's verify the connection with a simple count
    const { count, error: countError } = await supabase
      .from('wineries')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Connection test failed:', countError);
      console.error('Count error details:', {
        code: countError.code,
        message: countError.message,
        details: countError.details,
        hint: countError.hint
      });
      throw new Error(`Database connection failed: ${(countError as PostgrestError).message}`);
    }
    
    console.log(`Total wineries in database: ${count}`);

    // Now fetch the actual data
    const { data, error } = await supabase
      .from('wineries')
      .select('*');

    if (error) {
      console.error('Supabase error fetching wineries:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to fetch wineries: ${(error as PostgrestError).message}`);
    }

    if (!data || data.length === 0) {
      console.warn('No wineries found in the database');
      console.warn('Query returned:', { data, error });
      return { type: 'FeatureCollection', features: [] };
    }

    console.log(`Fetched ${data.length} wineries from database`);
    console.log('Sample winery data:', data[0]);
    
    // Debug: Check kosher values
    const kosherCount = (data as WineryRow[]).filter(row => row.kosher === true).length;
    console.log(`Wineries with kosher=true: ${kosherCount} out of ${data.length}`);
    if (kosherCount > 0) {
      const kosherWineries = (data as WineryRow[]).filter(row => row.kosher === true);
      console.log('Sample kosher wineries:', kosherWineries.slice(0, 3).map(w => ({ name: w.name, kosher: w.kosher })));
    }
    
    const features = (data as WineryRow[])
      .map(createFeature)
      .filter((feature): feature is WineryFeature => feature !== null);
    
    // Debug: Check kosher in features
    const kosherFeatures = features.filter(f => f.properties.kosher === true);
    console.log(`Features with kosher=true: ${kosherFeatures.length} out of ${features.length}`);

    return {
      type: 'FeatureCollection',
      features
    };
  } catch (error) {
    console.error('Error in fetchWineriesFromDb:', error);
    throw error;
  }
}

export async function fetchWineShopsFromDb(): Promise<{ type: 'FeatureCollection'; features: WineryFeature[] }> {
  try {
    console.log('Fetching wine shops from Supabase...');
    
    // First, let's verify the connection with a simple count
    const { count, error: countError } = await supabase
      .from('wine_shops')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Connection test failed:', countError);
      console.error('Count error details:', {
        code: countError.code,
        message: countError.message,
        details: countError.details,
        hint: countError.hint
      });
      throw new Error(`Database connection failed: ${(countError as PostgrestError).message}`);
    }
    
    console.log(`Total wine shops in database: ${count}`);

    // Now fetch the actual data
    const { data, error } = await supabase
      .from('wine_shops')
      .select('*');

    if (error) {
      console.error('Supabase error fetching wine shops:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to fetch wine shops: ${(error as PostgrestError).message}`);
    }

    if (!data || data.length === 0) {
      console.warn('No wine shops found in the database');
      console.warn('Query returned:', { data, error });
      return { type: 'FeatureCollection', features: [] };
    }

    console.log(`Fetched ${data.length} wine shops from database`);
    console.log('Sample wine shop data:', data[0]);
    
    // Debug: Check kosher values
    const kosherCount = (data as WineryRow[]).filter(row => row.kosher === true).length;
    console.log(`Wine shops with kosher=true: ${kosherCount} out of ${data.length}`);
    if (kosherCount > 0) {
      const kosherShops = (data as WineryRow[]).filter(row => row.kosher === true);
      console.log('Sample kosher shops:', kosherShops.slice(0, 3).map(s => ({ name: s.name, kosher: s.kosher })));
    }
    
    const features = (data as WineryRow[])
      .map(createFeature)
      .filter((feature): feature is WineryFeature => feature !== null);
    
    // Debug: Check kosher in features
    const kosherFeatures = features.filter(f => f.properties.kosher === true);
    console.log(`Features with kosher=true: ${kosherFeatures.length} out of ${features.length}`);

    return {
      type: 'FeatureCollection',
      features
    };
  } catch (error) {
    console.error('Error in fetchWineShopsFromDb:', error);
    throw error;
  }
} 