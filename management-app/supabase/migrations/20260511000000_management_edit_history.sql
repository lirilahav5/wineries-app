-- Edit history for management portal: which column changed and when (manager saves only).
-- Run this in the Supabase SQL editor if migrations CLI is not used.

CREATE TABLE IF NOT EXISTS management_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('winery', 'wine_shop')),
  entity_id INTEGER NOT NULL,
  column_key TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  editor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_management_edit_history_entity
  ON management_edit_history (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_management_edit_history_time
  ON management_edit_history (edited_at DESC);

ALTER TABLE management_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "management_edit_history_select" ON management_edit_history;
CREATE POLICY "management_edit_history_select"
  ON management_edit_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "management_edit_history_insert" ON management_edit_history;
CREATE POLICY "management_edit_history_insert"
  ON management_edit_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "management_edit_history_delete" ON management_edit_history;
CREATE POLICY "management_edit_history_delete"
  ON management_edit_history FOR DELETE
  TO authenticated
  USING (true);
