-- Management app: authenticated users need INSERT/UPDATE on wineries & wine_shops.
-- Consumer map app: anon role needs SELECT (read-only).
--
-- Without INSERT/UPDATE policies for `authenticated`, saves fail with:
-- "new row violates row-level security policy"
-- (especially when combined with storage uploads + history inserts).

ALTER TABLE public.wineries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wine_shops ENABLE ROW LEVEL SECURITY;

-- Managers (logged in via Supabase Auth)
DROP POLICY IF EXISTS "management_auth_full_access_wineries" ON public.wineries;
CREATE POLICY "management_auth_full_access_wineries"
  ON public.wineries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "management_auth_full_access_wine_shops" ON public.wine_shops;
CREATE POLICY "management_auth_full_access_wine_shops"
  ON public.wine_shops
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public map (anon key) — read only; skip if you already have equivalent policies
DROP POLICY IF EXISTS "consumer_anon_select_wineries" ON public.wineries;
CREATE POLICY "consumer_anon_select_wineries"
  ON public.wineries
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "consumer_anon_select_wine_shops" ON public.wine_shops;
CREATE POLICY "consumer_anon_select_wine_shops"
  ON public.wine_shops
  FOR SELECT
  TO anon
  USING (true);
