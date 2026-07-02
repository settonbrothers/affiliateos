-- 0035_copy_engine_v2.sql
-- Module 6: Copy Engine v2
-- Adds template selection to ad_copy_generations and an admin-curated
-- hook library (copy_hook_library) for few-shot injection into the hook stage.

-- ── Template column on generations ──────────────────────────────────────────
ALTER TABLE ad_copy_generations ADD COLUMN IF NOT EXISTS template text
  CHECK (template IN (
    'AIDA', 'PAS', 'BAB', 'us_vs_them', 'story',
    'tiktok_reel', 'nurture', 'direct_offer', 'business'
  ));

-- ── Admin hook library ───────────────────────────────────────────────────────
-- Admin-curated hook examples injected as few-shot into the hook-writing stage.
-- Labelled good/bad so the model can learn both what to do and what to avoid.
CREATE TABLE copy_hook_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  lang text NOT NULL CHECK (lang IN ('he', 'en')),
  hook_type text NOT NULL CHECK (hook_type IN (
    'curiosity', 'pain', 'social_proof', 'pattern_interrupt', 'data',
    'story', 'challenge', 'benefit', 'fear', 'authority'
  )),
  vertical text,
  label text NOT NULL DEFAULT 'good' CHECK (label IN ('good', 'bad')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE copy_hook_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage copy_hook_library"
  ON copy_hook_library FOR ALL
  USING (is_current_user_admin());

CREATE POLICY "members read copy_hook_library"
  ON copy_hook_library FOR SELECT
  USING (true);
