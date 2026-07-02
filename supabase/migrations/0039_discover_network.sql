-- Network data for discovered offers (manually entered in Phase 1)
CREATE TABLE offer_network_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  network_name text NOT NULL CHECK (network_name IN ('MaxBounty', 'Clickbank', 'CJ', 'ShareASale', 'Impact', 'Other')),
  epc_usd numeric(10,4),
  commission_rate numeric(5,2),  -- percentage
  commission_type text CHECK (commission_type IN ('CPA', 'RevShare', 'Hybrid', 'CPS')),
  payout_usd numeric(10,2),
  network_url text,
  is_recommended boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(offer_id, network_name)
);
ALTER TABLE offer_network_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage offer_network_data" ON offer_network_data FOR ALL USING (is_current_user_admin());
CREATE POLICY "members read offer_network_data" ON offer_network_data FOR SELECT USING (true);
CREATE INDEX offer_network_data_offer_idx ON offer_network_data(offer_id);

-- Add trending signals to offers table
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS trending_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_signal text CHECK (trending_signal IN ('rising', 'stable', 'declining', null));
