-- Path: supabase/migrations/0033_deep_brief.sql
CREATE TABLE offer_deep_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES ai_runs(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE offer_deep_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage deep briefs"
  ON offer_deep_briefs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX ON offer_deep_briefs(offer_id);
CREATE INDEX ON offer_deep_briefs(workspace_id);

INSERT INTO usage_pricing_rules (action, credits) VALUES
  ('generate-deep-brief', 5)
ON CONFLICT (action) DO NOTHING;
