-- Premium membership flag and optional expiry date (wineries + wine shops).

ALTER TABLE wineries
  ADD COLUMN IF NOT EXISTS premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_expires_at date;

ALTER TABLE wine_shops
  ADD COLUMN IF NOT EXISTS premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_expires_at date;
