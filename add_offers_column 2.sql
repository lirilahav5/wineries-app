-- Add "offers" column to wineries and wine_shops tables
-- Run this in Supabase SQL Editor

-- Add offers column to wineries table
ALTER TABLE public.wineries 
ADD COLUMN IF NOT EXISTS offers TEXT;

-- Add offers column to wine_shops table
ALTER TABLE public.wine_shops 
ADD COLUMN IF NOT EXISTS offers TEXT;

-- Set default to null (blank)
ALTER TABLE public.wineries 
ALTER COLUMN offers SET DEFAULT NULL;

ALTER TABLE public.wine_shops 
ALTER COLUMN offers SET DEFAULT NULL;

