-- 1) Typages
create table if not exists billing_document_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Colonnes de typage (phase 1 nullable)
alter table quotes add column if not exists document_type_id uuid references billing_document_types(id);
alter table invoices add column if not exists document_type_id uuid references billing_document_types(id);
alter table credit_notes add column if not exists document_type_id uuid references billing_document_types(id);

create index if not exists idx_quotes_document_type on quotes(document_type_id);
create index if not exists idx_invoices_document_type on invoices(document_type_id);
create index if not exists idx_credit_notes_document_type on credit_notes(document_type_id);

-- 3) Vue récap (mois/type)
create or replace view billing_sales_recaps_by_type as
select
  date_trunc('month', i.date_issued)::date as month,
  i.document_type_id,
  dt.label as document_type_label,
  sum(coalesce(i.total_ht,0)) as total_ht,
  sum(coalesce(i.tva,0)) as total_tva,
  sum(coalesce(i.total_ttc,0)) as total_ttc,
  count(*) as doc_count
from invoices i
left join billing_document_types dt on dt.id = i.document_type_id
group by 1,2,3;

-- 4) RLS (si RLS global est actif, reproduis les policies analogues aux autres tables billing)
-- NOTE: Adapter ces policies à votre modèle d'app:
-- alter table billing_document_types enable row level security;
-- create policy "bdt_select" on billing_document_types for select using (true);
-- create policy "bdt_insert" on billing_document_types for insert with check (true);
-- create policy "bdt_update" on billing_document_types for update using (true);
-- create policy "bdt_delete" on billing_document_types for delete using (false);

-- 5) Phase 2 (à appliquer après backfill) :
-- alter table quotes alter column document_type_id set not null;
-- alter table invoices alter column document_type_id set not null;
-- alter table credit_notes alter column document_type_id set not null;
