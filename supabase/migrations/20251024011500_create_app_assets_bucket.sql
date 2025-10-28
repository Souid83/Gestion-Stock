-- Create public storage bucket "app-assets" if it doesn't exist, and add RLS policies
-- This fixes "Bucket not found" errors for logo uploads and allows public reads

-- 1) Ensure bucket exists (public) with basic limits and image mime-types
do $$
begin
  if not exists (select 1 from storage.buckets where name = 'app-assets') then
    perform storage.create_bucket(
      bucket_name => 'app-assets',
      public => true,
      file_size_limit => 20971520, -- 20 MB
      allowed_mime_types => array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
    );
  end if;
end $$;

-- 2) RLS policies for storage.objects (enabled by default in Supabase)
-- Public READ access for objects within the app-assets bucket
create policy app_assets_public_read
  on storage.objects
  for select
  to public
  using (
    bucket_id = (select id from storage.buckets where name = 'app-assets')
  );

-- Authenticated INSERT to app-assets
create policy app_assets_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = (select id from storage.buckets where name = 'app-assets')
  );

-- Authenticated UPDATE within app-assets
create policy app_assets_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = (select id from storage.buckets where name = 'app-assets')
  )
  with check (
    bucket_id = (select id from storage.buckets where name = 'app-assets')
  );

-- Authenticated DELETE within app-assets
create policy app_assets_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = (select id from storage.buckets where name = 'app-assets')
  );
