import { createClient } from '@supabase/supabase-js';

// Use the actual Supabase credentials
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
      'x-application-name': 'wineries-app'
    }
  }
});

// Test the connection immediately
export const testConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    console.log('Using Supabase URL:', supabaseUrl);
    console.log('Using Supabase Key (first 10 chars):', supabaseKey.substring(0, 10) + '...');
    
    // First try a simple health check
    const { data: healthData, error: healthError } = await supabase.rpc('health_check');
    console.log('Health check result:', { healthData, healthError });

    // Then try the actual query
    console.log('Attempting to query wineries table...');
    const { data, error } = await supabase
      .from('wineries')
      .select('count')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Supabase query failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('Supabase connection successful! Query result:', data);
    return true;
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        // Add any additional properties that might be present
        ...(error as any)
      });
    }
    return false;
  }
};

// Types for our database tables
export interface Winery {
  id: number;
  name: string;
  region: string;
  description: string;
  image_url: string;
  address: string;
  phone: string;
  website: string;
  opening_hours: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Wine {
  id: number;
  winery_id: number;
  name: string;
  type: string;
  description: string;
  price: number;
  created_at: string;
}

// Database queries
export const getWineries = async () => {
  const { data, error } = await supabase
    .from('wineries')
    .select('*');
  
  if (error) throw error;
  return data as Winery[];
};

export const getWineryById = async (id: number) => {
  const { data, error } = await supabase
    .from('wineries')
    .select('*, wines(*)')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
};

export const searchWineries = async (query: string) => {
  const { data, error } = await supabase
    .from('wineries')
    .select('*')
    .or(`name.ilike.%${query}%,region.ilike.%${query}%`);
  
  if (error) throw error;
  return data as Winery[];
};

export const getWineriesByRegion = async (region: string) => {
  const { data, error } = await supabase
    .from('wineries')
    .select('*')
    .eq('region', region);
  
  if (error) throw error;
  return data as Winery[];
}; 