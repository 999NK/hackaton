CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

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

CREATE TABLE IF NOT EXISTS project_token_aliases (
  token text PRIMARY KEY,
  project_id text NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS scanner_chunk_uploads (
  upload_id text PRIMARY KEY,
  project_id text NOT NULL,
  scan_id text NOT NULL,
  schema_version text DEFAULT '',
  bundle_version text DEFAULT '',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'receiving',
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scanner_upload_chunks (
  upload_id text NOT NULL,
  artifact_id text NOT NULL,
  filename text NOT NULL,
  chunk_index integer NOT NULL,
  total_chunks integer NOT NULL,
  byte_offset bigint NOT NULL,
  chunk_sha256 text NOT NULL,
  artifact_sha256 text NOT NULL,
  artifact_size_bytes bigint NOT NULL,
  content bytea NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, artifact_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id text,
  external_scan_id text,
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
  expected_artifacts integer NOT NULL DEFAULT 0,
  received_artifacts integer NOT NULL DEFAULT 0,
  valid_artifacts integer NOT NULL DEFAULT 0,
  scanner_version text DEFAULT '',
  schema_version text DEFAULT '',
  bundle_version text DEFAULT '',
  completed_at timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scan_artifacts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scan_id text NOT NULL,
  artifact_type text NOT NULL,
  filename text NOT NULL,
  content_type text DEFAULT '',
  raw_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes integer NOT NULL DEFAULT 0,
  sha256 text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  validation_status text NOT NULL DEFAULT 'not_started',
  processing_status text NOT NULL DEFAULT 'not_started',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wcag_findings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scan_id text NOT NULL,
  fingerprint text NOT NULL,
  rule_id text DEFAULT '',
  severity text DEFAULT 'unknown',
  file_path text DEFAULT '',
  line integer DEFAULT 0,
  column_number integer DEFAULT 0,
  selector text DEFAULT '',
  occurrence_count integer NOT NULL DEFAULT 1,
  suggestion text DEFAULT '',
  affected_screens jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
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

CREATE TABLE IF NOT EXISTS semantic_entity_embeddings (
  entity_id text PRIMARY KEY REFERENCES semantic_entities(id) ON DELETE CASCADE,
  scan_id text,
  project_id text,
  type text DEFAULT '',
  slug text DEFAULT '',
  name text DEFAULT '',
  path text DEFAULT '',
  content text NOT NULL DEFAULT '',
  embedding vector(1536) NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_action_cache (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id text,
  scan_id text,
  endpoint text NOT NULL,
  cache_key text NOT NULL,
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  hits integer NOT NULL DEFAULT 0,
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
ALTER TABLE scans ADD COLUMN IF NOT EXISTS external_scan_id text;
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
ALTER TABLE scans ADD COLUMN IF NOT EXISTS expected_artifacts integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS received_artifacts integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS valid_artifacts integer DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scanner_version text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS schema_version text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS bundle_version text DEFAULT '';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS completed_at timestamptz;
UPDATE scans SET files_scanned = COALESCE(files_scanned, files_count, 0) WHERE files_scanned IS NULL;
ALTER TABLE scans ALTER COLUMN files_scanned SET DEFAULT 0;
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

ALTER TABLE scan_artifacts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS content_type text DEFAULT '';
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS raw_content jsonb DEFAULT '{}'::jsonb;
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS size_bytes integer DEFAULT 0;
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS sha256 text DEFAULT '';
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS required boolean DEFAULT false;
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'not_started';
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'not_started';
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE scan_artifacts ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();

ALTER TABLE wcag_findings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS fingerprint text DEFAULT '';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS rule_id text DEFAULT '';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS severity text DEFAULT 'unknown';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS file_path text DEFAULT '';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS line integer DEFAULT 0;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS column_number integer DEFAULT 0;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS selector text DEFAULT '';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS occurrence_count integer DEFAULT 1;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS suggestion text DEFAULT '';
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS affected_screens jsonb DEFAULT '[]'::jsonb;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS created timestamptz DEFAULT now();
ALTER TABLE wcag_findings ADD COLUMN IF NOT EXISTS updated timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_token ON projects(token);
CREATE INDEX IF NOT EXISTS idx_project_token_aliases_project ON project_token_aliases(project_id);
CREATE INDEX IF NOT EXISTS idx_scanner_chunks_upload ON scanner_upload_chunks(upload_id, artifact_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_project_external ON scans(project_id, external_scan_id) WHERE external_scan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scans_project_status_created ON scans(project_id, status, created DESC);
CREATE INDEX IF NOT EXISTS idx_entities_scan ON semantic_entities(scan_id);
CREATE INDEX IF NOT EXISTS idx_entities_scan_type ON semantic_entities(scan_id, type);
CREATE INDEX IF NOT EXISTS idx_rels_scan ON relationships(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_artifacts_scan ON scan_artifacts(scan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_artifacts_idempotency ON scan_artifacts(scan_id, artifact_type, filename, sha256);
CREATE INDEX IF NOT EXISTS idx_wcag_findings_scan ON wcag_findings(scan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wcag_findings_fingerprint ON wcag_findings(scan_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_entity_embeddings_project_scan ON semantic_entity_embeddings(project_id, scan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_action_cache_key ON ai_action_cache(project_id, endpoint, cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_action_cache_project ON ai_action_cache(project_id, endpoint, updated DESC);
DROP INDEX IF EXISTS idx_entity_embeddings_vector;

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

DROP TRIGGER IF EXISTS touch_scan_artifacts_updated_at ON scan_artifacts;
CREATE TRIGGER touch_scan_artifacts_updated_at
BEFORE UPDATE ON scan_artifacts
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_wcag_findings_updated_at ON wcag_findings;
CREATE TRIGGER touch_wcag_findings_updated_at
BEFORE UPDATE ON wcag_findings
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_entity_embeddings_updated_at ON semantic_entity_embeddings;
CREATE TRIGGER touch_entity_embeddings_updated_at
BEFORE UPDATE ON semantic_entity_embeddings
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_ai_action_cache_updated_at ON ai_action_cache;
CREATE TRIGGER touch_ai_action_cache_updated_at
BEFORE UPDATE ON ai_action_cache
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
