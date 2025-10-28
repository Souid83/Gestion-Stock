-- Customer contacts (phones, emails), SIREN on customers, and region on addresses
-- Structured option with dedicated tables + basic RLS

-- 1) Add SIREN to customers (nullable), with uniqueness when not null
alter table if exists customers
  add column if not exists siren text;

-- Basic format guard (optional): 9 digits when provided
create or replace function is_valid_siren(s text)
returns boolean language sql immutable as $$
  select s ~ '^[0-9]{9}$'
$$;

-- Unique index for non-null SIREN
create unique index if not exists uniq_customers_siren
  on customers (siren)
  where siren is not null;

-- 2) Add region on customer_addresses (to support geo filters and auto-fill by CP)
alter table if exists customer_addresses
  add column if not exists region text;

create index if not exists idx_customer_addresses_region on customer_addresses(region);

-- 3) Customer emails table
create table if not exists customer_emails (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  email text not null,
  is_primary boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_emails_customer on customer_emails(customer_id);
create unique index if not exists uniq_customer_emails_value on customer_emails(customer_id, email);

-- Optionally ensure a single primary per customer via partial unique index
create unique index if not exists uniq_customer_emails_primary
  on customer_emails(customer_id)
  where is_primary = true;

-- 4) Customer phones table
create table if not exists customer_phones (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  phone text not null,
  is_primary boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_phones_customer on customer_phones(customer_id);
create unique index if not exists uniq_customer_phones_value on customer_phones(customer_id, phone);

create unique index if not exists uniq_customer_phones_primary
  on customer_phones(customer_id)
  where is_primary = true;

-- 5) RLS and policies
alter table customer_emails enable row level security;
alter table customer_phones enable row level security;

-- If your customers table is tenant-scoped by auth.uid(), restrict access to records belonging to the current user.
-- Assumes customers.user_id exists and matches auth.uid(). If not, adjust policies accordingly.

-- Emails
drop policy if exists customer_emails_select on customer_emails;
create policy customer_emails_select
  on customer_emails
  for select
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_emails_insert on customer_emails;
create policy customer_emails_insert
  on customer_emails
  for insert
  to authenticated
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_emails_update on customer_emails;
create policy customer_emails_update
  on customer_emails
  for update
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_emails_delete on customer_emails;
create policy customer_emails_delete
  on customer_emails
  for delete
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

-- Phones
drop policy if exists customer_phones_select on customer_phones;
create policy customer_phones_select
  on customer_phones
  for select
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_phones_insert on customer_phones;
create policy customer_phones_insert
  on customer_phones
  for insert
  to authenticated
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_phones_update on customer_phones;
create policy customer_phones_update
  on customer_phones
  for update
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );

drop policy if exists customer_phones_delete on customer_phones;
create policy customer_phones_delete
  on customer_phones
  for delete
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
      and (c.user_id is null or c.user_id = auth.uid())
    )
  );
