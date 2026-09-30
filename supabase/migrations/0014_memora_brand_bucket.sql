-- Funeral-home logos. Public to read (they appear on public memorials and in
-- printed programmes); written only by the server after an org.branding check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memora-brand', 'memora-brand', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
