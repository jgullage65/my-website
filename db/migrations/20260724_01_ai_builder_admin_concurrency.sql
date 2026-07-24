ALTER TABLE ai_builder_admin_notes
  ADD COLUMN IF NOT EXISTS state_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ai_builder_purchase_interest
  ADD COLUMN IF NOT EXISTS state_revision INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_builder_admin_notes_state_revision_nonnegative') THEN
    ALTER TABLE ai_builder_admin_notes ADD CONSTRAINT ai_builder_admin_notes_state_revision_nonnegative CHECK (state_revision >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_builder_purchase_interest_state_revision_nonnegative') THEN
    ALTER TABLE ai_builder_purchase_interest ADD CONSTRAINT ai_builder_purchase_interest_state_revision_nonnegative CHECK (state_revision >= 0);
  END IF;
END $$;
