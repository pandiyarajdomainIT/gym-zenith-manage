
-- Roles
create type public.app_role as enum ('admin','staff');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'admin',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users can read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles select own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());

-- Auto create profile + admin role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Members
create type public.gender_t as enum ('male','female','other');
create type public.member_status_t as enum ('active','expired','frozen');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_code text not null,
  full_name text not null,
  phone text not null,
  address text,
  age int,
  gender gender_t,
  joining_date date not null default current_date,
  plan_months int not null default 1,
  plan_price numeric(10,2) not null default 0,
  expiry_date date not null,
  photo_url text,
  status member_status_t not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, member_code)
);
create index members_owner_idx on public.members(owner_id);
create index members_expiry_idx on public.members(expiry_date);
alter table public.members enable row level security;

create trigger members_updated before update on public.members for each row execute function public.set_updated_at();

create policy "members admin all" on public.members for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  notes text
);
create index attendance_member_idx on public.attendance(member_id);
create index attendance_date_idx on public.attendance(checked_in_at);
alter table public.attendance enable row level security;
create policy "attendance admin all" on public.attendance for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Payments
create type public.payment_status_t as enum ('paid','pending','overdue');
create type public.payment_method_t as enum ('cash','card','upi','bank','other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,
  paid_on date not null default current_date,
  method payment_method_t not null default 'cash',
  status payment_status_t not null default 'paid',
  notes text,
  created_at timestamptz not null default now()
);
create index payments_member_idx on public.payments(member_id);
create index payments_date_idx on public.payments(paid_on);
alter table public.payments enable row level security;
create policy "payments admin all" on public.payments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Storage bucket for member photos
insert into storage.buckets (id, name, public) values ('member-photos','member-photos', true)
on conflict (id) do nothing;

create policy "member photos public read" on storage.objects for select using (bucket_id = 'member-photos');
create policy "member photos admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.has_role(auth.uid(),'admin'));
create policy "member photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.has_role(auth.uid(),'admin'));
create policy "member photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.has_role(auth.uid(),'admin'));
