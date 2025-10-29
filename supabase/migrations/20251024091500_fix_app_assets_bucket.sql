-- Fix: create public storage bucket "app-assets" with version-compatible fallback and idempotent policies

-- 1) Ensure bucket exists (attempt function call, fallback to direct insert if function signature not available)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'app-assets') then
    begin
      -- Most common signature: (name text, public boolean)
      perform storage.create_bucket('app-assets', true);
    exception
      when undefined_function then
        -- Fallback: direct insert into storage.buckets
        insert into storage.buckets (id, name, public)
        values ('app-assets', 'app-assets', true)
        on conflict (id) do nothing;
    end;
  end if;
end $$;

-- 2) Optionally set limits/types only if columns exist on your instance
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
  ) then
    update storage.buckets
      set file_size_limit = 20971520 -- 20 MB
    where id = 'app-assets';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
      set allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
    where id = 'app-assets';
  end if;
end $$;

-- 3) Idempotent Storage Policies scoped to the bucket "app-assets"
drop policy if exists app_assets_public_read on storage.objects;
create policy app_assets_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'app-assets');

drop policy if exists app_assets_authenticated_insert on storage.objects;
create policy app_assets_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'app-assets');

drop policy if exists app_assets_authenticated_update on storage.objects;
create policy app_assets_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'app-assets')
  with check (bucket_id = 'app-assets');

drop policy if exists app_assets_authenticated_delete on storage.objects;
create policy app_assets_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'app-assets');
