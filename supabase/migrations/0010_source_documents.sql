-- 0010_source_documents.sql
-- A fetched / pasted document attached to an offer. The raw HTML lives in the
-- `source-documents` storage bucket (not in this table); `raw_text` is the
-- extracted plain text the AI sees.

create type source_doc_status as enum ('pending', 'fetched', 'extracted', 'failed');
create type source_doc_type as enum (
  'product_page', 'pricing_page', 'affiliate_terms', 'checkout_page',
  'review_page', 'ad_example', 'landing_page', 'manual_note', 'unknown'
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  url text,  -- nullable: manual_note has no URL
  doc_type source_doc_type not null default 'unknown',
  status source_doc_status not null default 'pending',
  raw_html_storage_path text,
  raw_text text,
  language text,
  source_summary text,
  source_reliability_score int,
  error_message text,
  fetched_at timestamptz,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index source_documents_offer_idx on source_documents(offer_id);
create index source_documents_status_idx on source_documents(status);

alter table source_documents enable row level security;
create policy "admin manage source_documents" on source_documents for all
  using (is_current_user_admin());
