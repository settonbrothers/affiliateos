-- 0038_diagnose_v2.sql
-- Module 9: Diagnose v2 — creative analysis + learning loop.
-- Adds creative_analysis, winning_hooks, and winners_added_to_library columns
-- to result_diagnoses, plus a new diagnose_creative_inputs tracking table.

-- ── Extend result_diagnoses ──────────────────────────────────────────────────
ALTER TABLE result_diagnoses
  ADD COLUMN IF NOT EXISTS creative_analysis jsonb,
  ADD COLUMN IF NOT EXISTS winning_hooks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS winners_added_to_library boolean DEFAULT false;

-- ── Track creative inputs that were analyzed ─────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnose_creative_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id),
  raw_input text NOT NULL,
  input_type text NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'batch')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE diagnose_creative_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage diagnose_creative_inputs"
  ON diagnose_creative_inputs FOR ALL
  USING (is_current_user_admin());

CREATE POLICY "members manage diagnose_creative_inputs"
  ON diagnose_creative_inputs FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
