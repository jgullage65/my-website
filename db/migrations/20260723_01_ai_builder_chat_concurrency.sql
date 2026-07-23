CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ai_builder_projects ADD COLUMN IF NOT EXISTS state_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_builder_chat_messages ADD COLUMN IF NOT EXISTS sequence INTEGER;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at, id)::integer AS sequence
  FROM ai_builder_chat_messages
)
UPDATE ai_builder_chat_messages messages SET sequence=numbered.sequence FROM numbered WHERE messages.id=numbered.id;

ALTER TABLE ai_builder_chat_messages ALTER COLUMN sequence SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_builder_chat_messages_thread_sequence_idx ON ai_builder_chat_messages(thread_id,sequence);

CREATE TABLE IF NOT EXISTS ai_builder_chat_exchanges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES ai_builder_projects(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES ai_builder_chat_threads(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT,
  status TEXT,
  owner_token TEXT,
  pending_expires_at TIMESTAMPTZ,
  user_message_id TEXT REFERENCES ai_builder_chat_messages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  assistant_message_id TEXT REFERENCES ai_builder_chat_messages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_message_count INTEGER,
  memory_revision INTEGER,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id,thread_id,idempotency_key)
);

ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS owner_token TEXT;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE ai_builder_chat_exchanges ADD COLUMN IF NOT EXISTS failure_code TEXT;
ALTER TABLE ai_builder_chat_exchanges ALTER COLUMN user_message_id DROP NOT NULL;
ALTER TABLE ai_builder_chat_exchanges ALTER COLUMN assistant_message_id DROP NOT NULL;
ALTER TABLE ai_builder_chat_exchanges ALTER COLUMN user_message_count DROP NOT NULL;

UPDATE ai_builder_chat_exchanges
SET request_fingerprint=encode(digest(COALESCE((SELECT content FROM ai_builder_chat_messages WHERE id=user_message_id),''),'sha256'),'hex'),
    status='completed', completed_at=COALESCE(completed_at,created_at)
WHERE request_fingerprint IS NULL OR status IS NULL;

ALTER TABLE ai_builder_chat_exchanges ALTER COLUMN request_fingerprint SET NOT NULL;
ALTER TABLE ai_builder_chat_exchanges ALTER COLUMN status SET NOT NULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_builder_chat_exchanges_status_check') THEN ALTER TABLE ai_builder_chat_exchanges ADD CONSTRAINT ai_builder_chat_exchanges_status_check CHECK(status IN ('pending','completed','failed')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_builder_chat_exchanges_fingerprint_check') THEN ALTER TABLE ai_builder_chat_exchanges ADD CONSTRAINT ai_builder_chat_exchanges_fingerprint_check CHECK(length(request_fingerprint)=64); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_builder_chat_exchanges_lifecycle_check') THEN ALTER TABLE ai_builder_chat_exchanges ADD CONSTRAINT ai_builder_chat_exchanges_lifecycle_check CHECK((status='pending' AND owner_token IS NOT NULL AND pending_expires_at IS NOT NULL) OR (status='completed' AND user_message_id IS NOT NULL AND assistant_message_id IS NOT NULL AND user_message_count IS NOT NULL AND completed_at IS NOT NULL) OR (status='failed' AND failed_at IS NOT NULL)); END IF; END $$;
CREATE INDEX IF NOT EXISTS ai_builder_chat_exchanges_pending_project_idx ON ai_builder_chat_exchanges(project_id,pending_expires_at) WHERE status='pending';
