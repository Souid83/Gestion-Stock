-- Fix customer_emails / customer_phones RLS policies without relying on customers.user_id

-- Ensure RLS is enabled
alter table if exists customer_emails enable row level security;
alter table if exists customer_phones enable row level security;

-- Emails policies (idempotent: drop then create)
drop policy if exists customer_emails_select on customer_emails;
create policy customer_emails_select
  on customer_emails
  for select
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
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
    )
  )
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_emails.customer_id
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
    )
  );

-- Phones policies
drop policy if exists customer_phones_select on customer_phones;
create policy customer_phones_select
  on customer_phones
  for select
  to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
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
    )
  )
  with check (
    exists (
      select 1 from customers c
      where c.id = customer_phones.customer_id
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
    )
  );
