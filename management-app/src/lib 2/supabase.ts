import { createClient } from '@supabase/supabase-js';

// Supabase connection - same database as wineries-app
const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';

// Create and export a single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'management-app'
    }
  }
});

// Database types
export interface Winery {
  id: number;
  name: string;
  address: string | null;
  place_id: string | null;
  region: string | null;
  kosher: boolean | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | string[] | null;
  is_open: boolean | null;
  lat: number | null;
  lng: number | null;
  geometry: string | null;
  offers: string | null;
  logo_url: string | null;
  logo_paid: boolean | null;
}

export interface WineShop {
  id: number;
  name: string;
  address: string | null;
  place_id: string | null;
  region: string | null;
  kosher: boolean | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | string[] | null;
  is_open: boolean | null;
  lat: number | null;
  lng: number | null;
  geometry: string | null;
  offers: string | null;
  logo_url: string | null;
  logo_paid: boolean | null;
}
