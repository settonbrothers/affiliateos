CREATE TABLE spy_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES ai_runs(id),
  input_type text NOT NULL CHECK (input_type IN ('text', 'url', 'batch')),
  raw_input text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spy_analyses ENABLE ROW LEVEL SECURITY;
-- RLS: admin can do all, members can select their workspace (same pattern as offer_deep_briefs)
CREATE POLICY "admin manage spy_analyses" ON spy_analyses FOR ALL USING (is_current_user_admin());
CREATE POLICY "members manage spy_analyses" ON spy_analyses FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE INDEX spy_analyses_offer_idx ON spy_analyses(offer_id);
CREATE INDEX spy_analyses_workspace_idx ON spy_analyses(workspace_id);
-- Pricing: 2 credits per analysis
INSERT INTO usage_pricing_rules (action, credits) VALUES ('analyze-spy', 2)
  ON CONFLICT (action) DO UPDATE SET credits = EXCLUDED.credits;
