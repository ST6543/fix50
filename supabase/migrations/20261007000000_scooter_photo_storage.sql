-- FIX50 migratie: scooterfoto's (profielfoto + PDF-dossier)
-- 1) Publieke storage-bucket 'scooter-photos'
-- 2) Policies: publiek lezen; schrijven alleen in de eigen map {user_id}/…

insert into storage.buckets (id, name, public)
values ('scooter-photos', 'scooter-photos', true)
on conflict (id) do nothing;

drop policy if exists "scooter-photos: publiek lezen" on storage.objects;
create policy "scooter-photos: publiek lezen"
  on storage.objects for select
  using (bucket_id = 'scooter-photos');

drop policy if exists "scooter-photos: eigenaar upload" on storage.objects;
create policy "scooter-photos: eigenaar upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'scooter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scooter-photos: eigenaar update" on storage.objects;
create policy "scooter-photos: eigenaar update"
  on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'scooter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scooter-photos: eigenaar verwijderen" on storage.objects;
create policy "scooter-photos: eigenaar verwijderen"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'scooter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
