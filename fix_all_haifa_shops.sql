-- Fix all shops/wineries in Haifa that are incorrectly tagged as "נגב"
-- Haifa coordinates: approximately lat 32.8, lng 35.0

-- Fix wine shops in Haifa
UPDATE public.wine_shops 
SET region = 'שרון' 
WHERE region = 'נגב' 
  AND lat >= 32.75 
  AND lat <= 32.85 
  AND lng >= 34.95 
  AND lng <= 35.05;

-- Fix wineries in Haifa
UPDATE public.wineries 
SET region = 'שרון' 
WHERE region = 'נגב' 
  AND lat >= 32.75 
  AND lat <= 32.85 
  AND lng >= 34.95 
  AND lng <= 35.05;

-- Show what was updated
SELECT 'wine_shops' as table_name, COUNT(*) as updated_count
FROM public.wine_shops 
WHERE region = 'שרון' 
  AND lat >= 32.75 
  AND lat <= 32.85 
  AND lng >= 34.95 
  AND lng <= 35.05
UNION ALL
SELECT 'wineries' as table_name, COUNT(*) as updated_count
FROM public.wineries 
WHERE region = 'שרון' 
  AND lat >= 32.75 
  AND lat <= 32.85 
  AND lng >= 34.95 
  AND lng <= 35.05;

