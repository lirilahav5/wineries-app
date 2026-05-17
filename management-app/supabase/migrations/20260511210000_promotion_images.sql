-- Multiple promotion image URLs per winery / wine shop (public Storage URLs; ordered array).

ALTER TABLE wineries
  ADD COLUMN IF NOT EXISTS promotion_image_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE wine_shops
  ADD COLUMN IF NOT EXISTS promotion_image_urls text[] NOT NULL DEFAULT '{}';
