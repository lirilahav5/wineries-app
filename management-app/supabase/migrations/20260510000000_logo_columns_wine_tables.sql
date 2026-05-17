-- logo_url / logo_paid for public map + management app (wineries + wine_shops).
-- If these columns are missing, saves fail with:
-- PGRST204 Could not find the 'logo_url' column of 'wine_shops' in the schema cache

ALTER TABLE public.wineries
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.wine_shops
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.wineries
  ALTER COLUMN logo_paid SET DEFAULT FALSE;

ALTER TABLE public.wine_shops
  ALTER COLUMN logo_paid SET DEFAULT FALSE;

-- Ask PostgREST to reload the schema cache (fixes PGRST204 after adding columns)
NOTIFY pgrst, 'reload schema';
