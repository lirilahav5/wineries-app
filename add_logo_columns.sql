-- Add logo_url and logo_paid columns to wineries and wine_shops tables
-- Run this in Supabase SQL Editor

-- Add logo columns to wineries table
ALTER TABLE public.wineries 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.wineries 
ADD COLUMN IF NOT EXISTS logo_paid BOOLEAN DEFAULT FALSE;

-- Add logo columns to wine_shops table
ALTER TABLE public.wine_shops 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.wine_shops 
ADD COLUMN IF NOT EXISTS logo_paid BOOLEAN DEFAULT FALSE;

-- Set defaults
ALTER TABLE public.wineries 
ALTER COLUMN logo_paid SET DEFAULT FALSE;

ALTER TABLE public.wine_shops 
ALTER COLUMN logo_paid SET DEFAULT FALSE;
