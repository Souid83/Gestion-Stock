-- Marketplace orders idempotence store
-- Tracks processed marketplace order lines to ensure idempotent stock updates
-- Provider-specific unique key: (provider, marketplace_account_id, remote_order_id, remote_line_id)

create table if not exists marketplace_orders_processed (
  id uuid primary key default gen_random_uuid(),
  provider text not null, -- e.g. 'ebay'
  marketplace_account_id uuid references marketplace_accounts(id) on delete set null,
  remote_order_id text not null,
  remote_line_id text not null,
  product_id uuid references products(id) on delete set null,
  quantity integer not null default 0 check (quantity >= 0),
  processed_at timestamptz not null default now(),
  unique (provider, marketplace_account_id, remote_order_id, remote_line_id)
);

-- RLS
alter table marketplace_orders_processed enable row level security;

-- Policies:
-- 1) Allow authenticated users to read rows for their accounts only (or rows with NULL account id)
create policy "Users can read processed lines for their accounts"
  on marketplace_orders_processed
  for select
  to authenticated
  using (
    marketplace_account_id is null or exists (
      select 1
      from marketplace_accounts ma
      where ma.id = marketplace_orders_processed.marketplace_account_id
        and ma.user_id = auth.uid()
    )
  );

-- 2) Allow authenticated to insert (service role bypasses RLS anyway)
create policy "System/users can insert processed lines"
  on marketplace_orders_processed
  for insert
  to authenticated
  with check (true);

-- Optional: forbid updates/deletes for authenticated (service role can still do it)
create policy "No updates by users"
  on marketplace_orders_processed
  for update
  to authenticated
  using (false)
  with check (false);

create policy "No deletes by users"
  on marketplace_orders_processed
  for delete
  to authenticated
  using (false);

-- Indexes
create index if not exists idx_mop_account on marketplace_orders_processed(marketplace_account_id);
create index if not exists idx_mop_processed_at on marketplace_orders_processed(processed_at desc);
create index if not exists idx_mop_unique_lookup on marketplace_orders_processed(provider, marketplace_account_id, remote_order_id, remote_line_id);
