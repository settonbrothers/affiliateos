-- Path: supabase/migrations/0034_avatar_builder.sql
CREATE TABLE offer_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES ai_runs(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE offer_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage avatars"
  ON offer_avatars
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX offer_avatars_offer_idx ON offer_avatars(offer_id);
CREATE INDEX offer_avatars_workspace_idx ON offer_avatars(workspace_id);

INSERT INTO usage_pricing_rules (action, credits) VALUES
  ('generate-avatar', 3)
ON CONFLICT (action) DO NOTHING;
