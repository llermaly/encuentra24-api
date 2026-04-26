CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_listings_search_text_trgm
ON listings
USING gin ((
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(location, '')
) gin_trgm_ops);
