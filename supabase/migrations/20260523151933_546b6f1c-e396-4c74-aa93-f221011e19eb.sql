
-- 1) Make member-photos bucket private
update storage.buckets set public = false where id = 'member-photos';

-- 2) Drop overly-permissive public read policy if it exists, add admin-only policies for member-photos
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual ilike '%member-photos%' or with_check ilike '%member-photos%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end$$;

create policy "member-photos admin read"
on storage.objects for select to authenticated
using (bucket_id = 'member-photos' and public.has_role(auth.uid(), 'admin'));

create policy "member-photos admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'member-photos' and public.has_role(auth.uid(), 'admin'));

create policy "member-photos admin update"
on storage.objects for update to authenticated
using (bucket_id = 'member-photos' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'member-photos' and public.has_role(auth.uid(), 'admin'));

create policy "member-photos admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'member-photos' and public.has_role(auth.uid(), 'admin'));

-- 3) Lock down user_roles: only admins may insert/update/delete
create policy "admins manage user_roles insert"
on public.user_roles for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "admins manage user_roles update"
on public.user_roles for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "admins manage user_roles delete"
on public.user_roles for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));
