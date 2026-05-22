
-- Fix set_updated_at search path
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Restrict execute on SECURITY DEFINER functions
revoke execute on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Tighten storage select: still allow read via direct URL, prevent listing the whole bucket
drop policy if exists "member photos public read" on storage.objects;
create policy "member photos read by name" on storage.objects for select
  using (bucket_id = 'member-photos' and name is not null);
