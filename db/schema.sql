CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text DEFAULT '',
  avatar text DEFAULT '',
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  base_url text DEFAULT '',
  framework text DEFAULT '',
  language text DEFAULT '',
  user_id text,
  owner_id text,
  last_scanned_at timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id text,
  status text NOT NULL DEFAULT 'PROCESSING',
  files_count integer NOT NULL DEFAULT 0,
  secrets_found integer NOT NULL DEFAULT 0,
  error_message text DEFAULT '',
  phase text DEFAULT '',
  phase_detail text DEFAULT '',
  token_used integer NOT NULL DEFAULT 0,
  token_budget integer NOT NULL DEFAULT 0,
  files_uploaded integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  entities_count integer NOT NULL DEFAULT 0,
  token text NOT NULL DEFAULT '',
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semantic_entities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scan_id text,
  type text NOT NULL,
  name text NOT NULL,
  slug text DEFAULT '',
  path text DEFAULT '',
  page_title text DEFAULT '',
  semantic_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text DEFAULT '',
  accessibility_hint text DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationships (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scan_id text,
  source_id text,
  target_id text,
  type text NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE projects ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS token text DEFAULT gen_random_uuid()::text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS base_url text DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS framework text DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS language text DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_scanned_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE projects SET token = COALESCE(NULLIF(token, ''), gen_random_uuid()::text);
UPDATE projects SET created = COALESCE(created, created_at, now()) WHERE created IS NULL;
UPDATE projects SET updated = COALESCE(updated, created, created_at, now()) WHERE updated IS NULL;

ALTER TABLE scans ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS status text DEFAULT 'PROCESSING';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS files_count integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS error_message text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS phase text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS phase_detail text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS token_used integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS token_budget integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS files_uploaded integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS report jsonb DEFAULT '{}'::jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS entities_count integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE scans ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();
ALTER TABLE scans ADD COLUMN IF NOT EXISTS files_scanned integer;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS "timestamp" timestamptz;
UPDATE scans SET files_count = COALESCE(files_count, files_scanned, 0) WHERE files_count IS NULL;
UPDATE scans SET report = COALESCE(report, metadata, '{}'::jsonb) WHERE report IS NULL;
UPDATE scans SET created = COALESCE(created, "timestamp", now()) WHERE created IS NULL;
UPDATE scans SET updated = COALESCE(updated, created, "timestamp", now()) WHERE updated IS NULL;
UPDATE scans SET status = COALESCE(NULLIF(status, ''), 'COMPLETED') WHERE status IS NULL OR status = '';

ALTER TABLE semantic_entities ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS slug text DEFAULT '';
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS path text DEFAULT '';
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS page_title text DEFAULT '';
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS semantic_labels jsonb DEFAULT '[]'::jsonb;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS accessibility_hint text DEFAULT '';
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS evidence jsonb DEFAULT '[]'::jsonb;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS confidence_overall numeric;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE semantic_entities SET confidence = COALESCE(confidence, confidence_overall, 0) WHERE confidence IS NULL;
UPDATE semantic_entities SET created = COALESCE(created, created_at, now()) WHERE created IS NULL;
UPDATE semantic_entities SET updated = COALESCE(updated, created, created_at, now()) WHERE updated IS NULL;

ALTER TABLE relationships ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS scan_id text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS from_entity_id text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS to_entity_id text;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE relationships SET source_id = COALESCE(source_id, from_entity_id) WHERE source_id IS NULL;
UPDATE relationships SET target_id = COALESCE(target_id, to_entity_id) WHERE target_id IS NULL;
UPDATE relationships SET created = COALESCE(created, created_at, now()) WHERE created IS NULL;
UPDATE relationships SET updated = COALESCE(updated, created, created_at, now()) WHERE updated IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_token ON projects(token);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_scans_project_status_created ON scans(project_id, status, created DESC);
CREATE INDEX IF NOT EXISTS idx_entities_scan ON semantic_entities(scan_id);
CREATE INDEX IF NOT EXISTS idx_entities_scan_type ON semantic_entities(scan_id, type);
CREATE INDEX IF NOT EXISTS idx_rels_scan ON relationships(scan_id);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_users_updated_at ON users;
CREATE TRIGGER touch_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_projects_updated_at ON projects;
CREATE TRIGGER touch_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_scans_updated_at ON scans;
CREATE TRIGGER touch_scans_updated_at
BEFORE UPDATE ON scans
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_entities_updated_at ON semantic_entities;
CREATE TRIGGER touch_entities_updated_at
BEFORE UPDATE ON semantic_entities
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_relationships_updated_at ON relationships;
CREATE TRIGGER touch_relationships_updated_at
BEFORE UPDATE ON relationships
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
