CREATE TABLE offer_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES ai_runs(id),
  payload jsonb NOT NULL,  -- array of 7 creatives with briefs + image_url
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE offer_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage offer_creatives" ON offer_creatives FOR ALL USING (is_current_user_admin());
CREATE POLICY "members manage offer_creatives" ON offer_creatives FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE INDEX offer_creatives_offer_idx ON offer_creatives(offer_id);
CREATE INDEX offer_creatives_workspace_idx ON offer_creatives(workspace_id);
-- 7 credits (one per image)
INSERT INTO usage_pricing_rules (action, credits) VALUES ('generate-creative', 7)
  ON CONFLICT (action) DO UPDATE SET credits = EXCLUDED.credits;
