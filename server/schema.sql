-- Shekulli.info — PostgreSQL schema
-- Run once: psql -d shekulli -f schema.sql

CREATE TABLE IF NOT EXISTS articles (
  id           BIGSERIAL     PRIMARY KEY,
  fb_post_id   VARCHAR(255)  UNIQUE,          -- Facebook post ID (null for manual posts)
  title        TEXT          NOT NULL,
  standfirst   TEXT          DEFAULT '',
  body         TEXT          DEFAULT '',
  photo        TEXT          DEFAULT '',
  author       VARCHAR(255)  DEFAULT 'Shekulli.info',
  category     VARCHAR(100)  DEFAULT 'Lajme',
  kicker       VARCHAR(255)  DEFAULT '',
  published    BIGINT        NOT NULL,         -- Unix ms timestamp
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published   ON articles (published DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category    ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_fb_post_id  ON articles (fb_post_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
