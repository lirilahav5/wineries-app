-- Public bucket for winery / wine shop logo images uploaded from the management app.

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  name = EXCLUDED.name;

-- Anyone can read (bucket is public; used in consumer app URL field).
DROP POLICY IF EXISTS "business_logos_select_public" ON storage.objects;
CREATE POLICY "business_logos_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-logos');

-- Authenticated managers can upload / replace / delete their uploads.
DROP POLICY IF EXISTS "business_logos_insert_authenticated" ON storage.objects;
CREATE POLICY "business_logos_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "business_logos_update_authenticated" ON storage.objects;
CREATE POLICY "business_logos_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-logos')
  WITH CHECK (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "business_logos_delete_authenticated" ON storage.objects;
CREATE POLICY "business_logos_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-logos');
