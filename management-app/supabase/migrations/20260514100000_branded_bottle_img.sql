-- Custom branded bottle image per winery / wine shop (public Storage URL).
ALTER TABLE public.wineries
  ADD COLUMN IF NOT EXISTS branded_bottle_img TEXT;

ALTER TABLE public.wine_shops
  ADD COLUMN IF NOT EXISTS branded_bottle_img TEXT;

NOTIFY pgrst, 'reload schema';
