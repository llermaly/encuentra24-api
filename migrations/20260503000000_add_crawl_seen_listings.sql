CREATE TABLE IF NOT EXISTS crawl_seen_listings (
  crawl_run_id integer NOT NULL,
  ad_id text NOT NULL,
  seen_at text NOT NULL,
  CONSTRAINT crawl_seen_listings_pkey PRIMARY KEY (crawl_run_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_csl_ad_id ON crawl_seen_listings (ad_id);
CREATE INDEX IF NOT EXISTS idx_csl_seen_at ON crawl_seen_listings (seen_at);
