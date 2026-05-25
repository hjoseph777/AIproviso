-- =============================================================================
-- 03-extensions.sql
-- Enables required PostgreSQL extensions in the proviso database.
-- Runs once on container boot, idempotent (IF NOT EXISTS).
-- =============================================================================

\c proviso;

-- pgvector: stores and queries RAG embedding vectors (Section 4.1, 6.1)
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm: trigram indexing for fuzzy vendor name matching (Section 9.1)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp: gen_random_uuid() is built-in on PG13+, but ossp provides
-- uuid_generate_v4() as an alternative if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  RAISE NOTICE 'Extensions enabled: vector, pg_trgm, uuid-ossp';
END $$;
