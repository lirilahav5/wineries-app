-- Find the Haifa shop that's incorrectly tagged as "נגב"
-- This will show you the record so you can update it manually

-- First, let's find it in wine_shops table
SELECT 
  id,
  name,
  address,
  phone,
  region,
  lat,
  lng
FROM public.wine_shops
WHERE 
  (name LIKE '%הרמיטאז%' OR name LIKE '%אילת%')
  AND (address LIKE '%חיפה%' OR address LIKE '%haifa%')
  AND phone = '077-998-4746'
ORDER BY id;

-- If found, update it to "צפון"
-- Uncomment the line below after you verify it's the right record:
-- UPDATE public.wine_shops SET region = 'צפון' WHERE phone = '077-998-4746' AND (address LIKE '%חיפה%' OR address LIKE '%haifa%');

-- Or update all Haifa shops that are incorrectly tagged as "נגב"
-- UPDATE public.wine_shops 
-- SET region = 'שרון' 
-- WHERE region = 'נגב' 
--   AND (address LIKE '%חיפה%' OR address LIKE '%haifa%' OR (lat >= 32.75 AND lat <= 32.85 AND lng >= 34.95 AND lng <= 35.05));

