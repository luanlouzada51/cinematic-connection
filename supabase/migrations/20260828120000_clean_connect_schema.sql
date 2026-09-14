-- =============================================================================
-- CleanConnect — schema inicial
--
-- Dois produtos no mesmo banco, com fronteiras bem definidas:
--   1. Operação: empresa <-> cliente (agenda, casas, preços, status ao vivo).
--   2. Mercado de trabalho: empresa <-> profissional (vagas, vínculo, avaliação).
--
-- Regra de privacidade central: quem entra como cliente NUNCA enxerga o mercado
-- de trabalho, e o profissional só enxerga preço quando a empresa permite.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
create type public.account_role as enum ('owner', 'worker', 'customer');
create type public.member_role as enum ('owner', 'manager', 'cleaner');
create type public.recurrence as enum (
  'one_time', 'weekly', 'biweekly', 'every_3_weeks', 'every_4_weeks', 'monthly'
);
create type public.service_type as enum (
  'standard', 'deep_clean', 'move_in_out', 'post_construction', 'office'
);
create type public.appointment_status as enum (
  'scheduled', 'on_my_way', 'in_progress', 'completed', 'canceled'
);
create type public.appointment_event_kind as enum (
  'on_my_way', 'clock_in', 'clock_out', 'completed', 'canceled'
);
-- Quem ficou com o dinheiro da casa. É o que permite o acerto no fim do período.
create type public.payment_collector as enum ('unpaid', 'company', 'worker');
create type public.pay_model as enum ('percentage', 'daily', 'hourly');
create type public.cleaning_skill as enum (
  'dusting', 'kitchen', 'bathroom', 'mopping', 'vacuum', 'windows',
  'laundry', 'ironing', 'organizing', 'deep_clean', 'move_out', 'office'
);
create type public.availability_period as enum ('morning', 'afternoon', 'full_day', 'night');
create type public.gig_status as enum ('open', 'filled', 'in_progress', 'completed', 'canceled');
create type public.gig_worker_status as enum (
  'hired', 'in_progress', 'completed', 'no_show', 'canceled'
);
create type public.application_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.thread_kind as enum ('customer', 'gig');
create type public.review_subject as enum ('company', 'worker');
create type public.payout_status as enum ('open', 'closed', 'settled');

-- ----------------------------------------------------------------------------
-- Contas
-- ----------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  city text,
  state text,
  locale text not null default 'pt',
  primary_role public.account_role not null default 'owner',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Empresas e equipe
-- ----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  city text,
  state text,
  logo_url text,
  -- Padrões de pagamento herdados por cada membro da equipe.
  default_pay_model public.pay_model not null default 'percentage',
  default_worker_percentage numeric(5, 2) not null default 80
    check (default_worker_percentage >= 0 and default_worker_percentage <= 100),
  default_daily_rate numeric(10, 2),
  default_hourly_rate numeric(10, 2),
  -- Controles de visibilidade pedidos pela empresa.
  show_prices_to_workers boolean not null default true,
  show_prices_to_customers boolean not null default true,
  allow_customer_chat boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  invite_email text,
  invite_code text unique,
  display_name text not null,
  role public.member_role not null default 'cleaner',
  pay_model public.pay_model,
  worker_percentage numeric(5, 2) check (worker_percentage >= 0 and worker_percentage <= 100),
  daily_rate numeric(10, 2),
  hourly_rate numeric(10, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, account_id)
);

create index company_members_account_idx on public.company_members (account_id);

-- ----------------------------------------------------------------------------
-- Clientes e casas
-- ----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Preenchido quando o cliente aceita o convite e passa a acompanhar pelo app.
  account_id uuid references public.accounts (id) on delete set null,
  portal_code text unique,
  name text not null,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_company_idx on public.customers (company_id);
create index customers_account_idx on public.customers (account_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default 'Casa',
  address_line1 text not null,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  bedrooms int,
  bathrooms int,
  square_feet int,
  access_notes text,
  parking_notes text,
  created_at timestamptz not null default now()
);

create index properties_customer_idx on public.properties (customer_id);

-- ----------------------------------------------------------------------------
-- Agenda
-- ----------------------------------------------------------------------------

-- Um contrato recorrente ("quinzenal, 200 dólares, terça de manhã"). Cada
-- ocorrência vira uma linha em appointments, que pode ser editada sozinha.
create table public.service_series (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  service_type public.service_type not null default 'standard',
  recurrence public.recurrence not null default 'one_time',
  start_date date not null,
  start_time time not null default '09:00',
  duration_minutes int not null default 120 check (duration_minutes > 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  series_id uuid references public.service_series (id) on delete set null,
  service_type public.service_type not null default 'standard',
  scheduled_date date not null,
  start_time time not null default '09:00',
  end_time time,
  price numeric(10, 2) not null default 0 check (price >= 0),
  status public.appointment_status not null default 'scheduled',
  payment_collector public.payment_collector not null default 'unpaid',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_company_date_idx on public.appointments (company_id, scheduled_date);
create index appointments_customer_idx on public.appointments (customer_id, scheduled_date);

create table public.appointment_assignments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (appointment_id, member_id)
);

create index appointment_assignments_member_idx on public.appointment_assignments (member_id);

-- Linha do tempo do serviço: a caminho, entrada, saída, concluído.
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  kind public.appointment_event_kind not null,
  note text,
  created_at timestamptz not null default now()
);

create index appointment_events_appointment_idx
  on public.appointment_events (appointment_id, created_at);

create table public.appointment_photos (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Conversas (empresa <-> cliente e empresa <-> profissional)
-- ----------------------------------------------------------------------------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  kind public.thread_kind not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  gig_id uuid,
  worker_id uuid references public.accounts (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'customer' and customer_id is not null)
    or (kind = 'gig' and gig_id is not null and worker_id is not null)
  )
);

create unique index threads_customer_unique_idx
  on public.threads (company_id, customer_id) where kind = 'customer';
create unique index threads_gig_unique_idx
  on public.threads (gig_id, worker_id) where kind = 'gig';

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null references public.accounts (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index thread_messages_thread_idx on public.thread_messages (thread_id, created_at);

-- ----------------------------------------------------------------------------
-- Mercado de trabalho
-- ----------------------------------------------------------------------------
create table public.worker_profiles (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  headline text,
  bio text,
  skills public.cleaning_skill[] not null default '{}',
  years_experience int,
  has_car boolean not null default false,
  radius_km int not null default 30,
  daily_rate numeric(10, 2),
  hourly_rate numeric(10, 2),
  accepts_percentage boolean not null default true,
  min_percentage numeric(5, 2) check (min_percentage >= 0 and min_percentage <= 100),
  -- O profissional escolhe aparecer ou não nas buscas.
  visible boolean not null default true,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  jobs_done int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.worker_availability (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  date date not null,
  period public.availability_period not null default 'full_day',
  note text,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

create index worker_availability_date_idx on public.worker_availability (date);

create table public.gigs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  description text,
  city text,
  state text,
  date date not null,
  start_time time not null default '09:00',
  end_time time,
  required_skills public.cleaning_skill[] not null default '{}',
  headcount int not null default 1 check (headcount > 0),
  pay_model public.pay_model not null default 'daily',
  daily_rate numeric(10, 2),
  hourly_rate numeric(10, 2),
  worker_percentage numeric(5, 2) check (worker_percentage >= 0 and worker_percentage <= 100),
  status public.gig_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gigs_date_idx on public.gigs (date, status);
create index gigs_company_idx on public.gigs (company_id, date);

alter table public.threads
  add constraint threads_gig_fkey foreign key (gig_id) references public.gigs (id) on delete cascade;

create table public.gig_applications (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs (id) on delete cascade,
  worker_id uuid not null references public.accounts (id) on delete cascade,
  message text,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (gig_id, worker_id)
);

create index gig_applications_worker_idx on public.gig_applications (worker_id);

-- O vínculo em si: existe do "contratado" até o "concluído", como uma corrida.
create table public.gig_workers (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs (id) on delete cascade,
  worker_id uuid not null references public.accounts (id) on delete cascade,
  status public.gig_worker_status not null default 'hired',
  started_at timestamptz,
  ended_at timestamptz,
  agreed_pay_model public.pay_model not null default 'daily',
  agreed_daily_rate numeric(10, 2),
  agreed_hourly_rate numeric(10, 2),
  agreed_percentage numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (gig_id, worker_id)
);

create index gig_workers_worker_idx on public.gig_workers (worker_id);

create table public.work_reviews (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs (id) on delete cascade,
  author_id uuid not null references public.accounts (id) on delete cascade,
  subject_kind public.review_subject not null,
  subject_account_id uuid references public.accounts (id) on delete cascade,
  subject_company_id uuid references public.companies (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (gig_id, author_id, subject_kind),
  check (
    (subject_kind = 'worker' and subject_account_id is not null)
    or (subject_kind = 'company' and subject_company_id is not null)
  )
);

create index work_reviews_worker_idx on public.work_reviews (subject_account_id);
create index work_reviews_company_idx on public.work_reviews (subject_company_id);

-- ----------------------------------------------------------------------------
-- Fechamento de pagamento
-- ----------------------------------------------------------------------------
create table public.payout_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  pay_model public.pay_model not null default 'percentage',
  worker_percentage numeric(5, 2) check (worker_percentage >= 0 and worker_percentage <= 100),
  daily_rate numeric(10, 2),
  hourly_rate numeric(10, 2),
  status public.payout_status not null default 'open',
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payout_periods_company_idx on public.payout_periods (company_id, start_date);

-- Descontos e bônus lançados por cima do cálculo (material, dano, gorjeta...).
create table public.payout_adjustments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payout_periods (id) on delete cascade,
  label text not null,
  -- Positivo aumenta o que o profissional recebe, negativo desconta.
  amount numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

-- Congela o resultado no momento do acerto, para o histórico não mudar quando
-- alguém editar o preço de uma casa antiga.
create table public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payout_periods (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  label text not null,
  service_date date not null,
  gross numeric(10, 2) not null default 0,
  collector public.payment_collector not null default 'unpaid',
  worker_share numeric(10, 2) not null default 0,
  company_share numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index payout_lines_period_idx on public.payout_lines (period_id);

-- ----------------------------------------------------------------------------
-- Funções auxiliares (security definer: não passam por RLS, evitam recursão)
-- ----------------------------------------------------------------------------
create or replace function public.is_company_member(_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = _company and m.account_id = auth.uid() and m.active
  );
$$;

create or replace function public.is_company_manager(_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = _company and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.company_members m
    where m.company_id = _company
      and m.account_id = auth.uid()
      and m.active
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.owns_customer(_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.id = _customer and c.account_id = auth.uid()
  );
$$;

create or replace function public.customer_company(_customer uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id from public.customers c where c.id = _customer;
$$;

create or replace function public.member_account(_member uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.account_id from public.company_members m where m.id = _member;
$$;

create or replace function public.is_assigned_to_appointment(_appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointment_assignments a
    join public.company_members m on m.id = a.member_id
    where a.appointment_id = _appointment and m.account_id = auth.uid()
  );
$$;

create or replace function public.appointment_company(_appointment uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.company_id from public.appointments a where a.id = _appointment;
$$;

create or replace function public.appointment_customer_account(_appointment uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.account_id
  from public.appointments a
  join public.customers c on c.id = a.customer_id
  where a.id = _appointment;
$$;

create or replace function public.gig_company(_gig uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.company_id from public.gigs g where g.id = _gig;
$$;

create or replace function public.is_thread_participant(_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.threads t
    left join public.customers c on c.id = t.customer_id
    where t.id = _thread
      and (
        public.is_company_member(t.company_id)
        or (select owner_id from public.companies where id = t.company_id) = auth.uid()
        or c.account_id = auth.uid()
        or t.worker_id = auth.uid()
      )
  );
$$;

-- Quem entra como cliente não participa do mercado de trabalho. A regra vive no
-- banco (e não só na navegação) para que nenhuma consulta direta contorne isso.
create or replace function public.is_marketplace_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts a
    where a.id = auth.uid() and a.primary_role in ('owner', 'worker')
  );
$$;

-- Contas visíveis entre si: mesma empresa, mesma vaga ou perfil público visível.
create or replace function public.can_see_account(_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _account = auth.uid()
    or exists (
      select 1
      from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.account_id = auth.uid() and theirs.account_id = _account
    )
    or exists (
      select 1 from public.companies c
      join public.company_members m on m.company_id = c.id
      where c.owner_id = auth.uid() and m.account_id = _account
    )
    or exists (
      select 1 from public.customers cu
      join public.companies c on c.id = cu.company_id
      where cu.account_id = auth.uid() and c.owner_id = _account
    )
    or exists (
      select 1 from public.worker_profiles w
      where w.account_id = _account and w.visible
    )
    or exists (
      select 1 from public.gig_workers gw
      join public.gigs g on g.id = gw.gig_id
      where gw.worker_id = _account and public.is_company_member(g.company_id)
    );
$$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
create trigger gigs_touch before update on public.gigs
  for each row execute function public.touch_updated_at();
create trigger worker_profiles_touch before update on public.worker_profiles
  for each row execute function public.touch_updated_at();
create trigger payout_periods_touch before update on public.payout_periods
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, full_name, avatar_url, primary_role, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'primary_role')::public.account_role, 'owner'),
    coalesce(new.raw_user_meta_data ->> 'locale', 'pt')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.bump_thread_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger thread_messages_bump
  after insert on public.thread_messages
  for each row execute function public.bump_thread_activity();

-- Mantém a média de estrelas do profissional sempre pronta para leitura.
create or replace function public.refresh_worker_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.subject_account_id, old.subject_account_id);
begin
  if target is null then
    return coalesce(new, old);
  end if;

  update public.worker_profiles w
  set rating_avg = coalesce(stats.avg_rating, 0),
      rating_count = coalesce(stats.total, 0)
  from (
    select avg(rating)::numeric(3, 2) as avg_rating, count(*) as total
    from public.work_reviews
    where subject_account_id = target and subject_kind = 'worker'
  ) as stats
  where w.account_id = target;

  return coalesce(new, old);
end;
$$;

create trigger work_reviews_refresh_rating
  after insert or update or delete on public.work_reviews
  for each row execute function public.refresh_worker_rating();

-- Espelha o status da vaga a partir do estado dos profissionais contratados.
create or replace function public.sync_gig_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.gig_id, old.gig_id);
  active_count int;
  running_count int;
  done_count int;
  slots int;
begin
  select count(*) filter (where status in ('hired', 'in_progress', 'completed')),
         count(*) filter (where status = 'in_progress'),
         count(*) filter (where status = 'completed')
    into active_count, running_count, done_count
  from public.gig_workers where gig_id = target;

  select headcount into slots from public.gigs where id = target;

  -- Os literais levam cast explícito: um CASE só de literais vira text e o
  -- Postgres recusa gravá-lo direto na coluna enum.
  update public.gigs
  set status = case
        when status = 'canceled' then 'canceled'::public.gig_status
        when running_count > 0 then 'in_progress'::public.gig_status
        when active_count > 0 and done_count = active_count then 'completed'::public.gig_status
        when active_count >= slots then 'filled'::public.gig_status
        else 'open'::public.gig_status
      end
  where id = target;

  return coalesce(new, old);
end;
$$;

create trigger gig_workers_sync_gig
  after insert or update or delete on public.gig_workers
  for each row execute function public.sync_gig_status();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.properties enable row level security;
alter table public.service_series enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_assignments enable row level security;
alter table public.appointment_events enable row level security;
alter table public.appointment_photos enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.worker_availability enable row level security;
alter table public.gigs enable row level security;
alter table public.gig_applications enable row level security;
alter table public.gig_workers enable row level security;
alter table public.work_reviews enable row level security;
alter table public.payout_periods enable row level security;
alter table public.payout_adjustments enable row level security;
alter table public.payout_lines enable row level security;

-- Contas
create policy accounts_select on public.accounts
  for select to authenticated using (public.can_see_account(id));
create policy accounts_update_own on public.accounts
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy accounts_insert_own on public.accounts
  for insert to authenticated with check (id = auth.uid());

-- Empresas: quem trabalha nela, quem é cliente dela, e quem vê uma vaga aberta.
create policy companies_select on public.companies
  for select to authenticated using (
    owner_id = auth.uid()
    or public.is_company_member(id)
    or exists (select 1 from public.customers c where c.company_id = id and c.account_id = auth.uid())
    or (public.is_marketplace_user() and exists (select 1 from public.gigs g where g.company_id = id))
  );
create policy companies_insert on public.companies
  for insert to authenticated with check (owner_id = auth.uid());
create policy companies_update on public.companies
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy companies_delete on public.companies
  for delete to authenticated using (owner_id = auth.uid());

-- Equipe
create policy company_members_select on public.company_members
  for select to authenticated using (
    account_id = auth.uid() or public.is_company_member(company_id)
  );
create policy company_members_manage on public.company_members
  for all to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));

-- Clientes e casas
create policy customers_company on public.customers
  for all to authenticated
  using (public.is_company_member(company_id) or public.is_company_manager(company_id))
  with check (public.is_company_member(company_id) or public.is_company_manager(company_id));
create policy customers_self on public.customers
  for select to authenticated using (account_id = auth.uid());

-- O dono também entra por is_company_manager: ele pode existir sem linha de
-- equipe (empresa criada antes de montar o time).
create policy properties_company on public.properties
  for all to authenticated
  using (
    public.is_company_member(public.customer_company(customer_id))
    or public.is_company_manager(public.customer_company(customer_id))
  )
  with check (
    public.is_company_member(public.customer_company(customer_id))
    or public.is_company_manager(public.customer_company(customer_id))
  );
create policy properties_customer on public.properties
  for select to authenticated using (public.owns_customer(customer_id));

create policy service_series_company on public.service_series
  for all to authenticated
  using (public.is_company_member(company_id) or public.is_company_manager(company_id))
  with check (public.is_company_member(company_id) or public.is_company_manager(company_id));
create policy service_series_customer on public.service_series
  for select to authenticated using (public.owns_customer(customer_id));

-- Agenda: empresa gerencia; cliente e profissional designado leem.
create policy appointments_company on public.appointments
  for all to authenticated
  using (public.is_company_member(company_id) or public.is_company_manager(company_id))
  with check (public.is_company_member(company_id) or public.is_company_manager(company_id));
create policy appointments_customer on public.appointments
  for select to authenticated using (public.owns_customer(customer_id));

create policy appointment_assignments_company on public.appointment_assignments
  for all to authenticated
  using (public.is_company_member(public.appointment_company(appointment_id)))
  with check (public.is_company_member(public.appointment_company(appointment_id)));
create policy appointment_assignments_customer on public.appointment_assignments
  for select to authenticated
  using (public.appointment_customer_account(appointment_id) = auth.uid());

create policy appointment_events_read on public.appointment_events
  for select to authenticated using (
    public.is_company_member(public.appointment_company(appointment_id))
    or public.appointment_customer_account(appointment_id) = auth.uid()
  );
create policy appointment_events_write on public.appointment_events
  for insert to authenticated with check (
    account_id = auth.uid()
    and public.is_company_member(public.appointment_company(appointment_id))
  );

create policy appointment_photos_read on public.appointment_photos
  for select to authenticated using (
    public.is_company_member(public.appointment_company(appointment_id))
    or public.appointment_customer_account(appointment_id) = auth.uid()
  );
create policy appointment_photos_write on public.appointment_photos
  for insert to authenticated with check (
    account_id = auth.uid()
    and public.is_company_member(public.appointment_company(appointment_id))
  );
create policy appointment_photos_delete on public.appointment_photos
  for delete to authenticated using (
    account_id = auth.uid()
    or public.is_company_manager(public.appointment_company(appointment_id))
  );

-- Conversas
create policy threads_read on public.threads
  for select to authenticated using (public.is_thread_participant(id));
create policy threads_create on public.threads
  for insert to authenticated with check (
    public.is_company_member(company_id)
    or (kind = 'customer' and public.owns_customer(customer_id))
    or (kind = 'gig' and worker_id = auth.uid())
  );

create policy thread_messages_read on public.thread_messages
  for select to authenticated using (public.is_thread_participant(thread_id));
create policy thread_messages_write on public.thread_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_thread_participant(thread_id));
create policy thread_messages_update on public.thread_messages
  for update to authenticated using (public.is_thread_participant(thread_id));

-- Mercado: perfis visíveis para quem tem conta de empresa ou profissional.
create policy worker_profiles_read on public.worker_profiles
  for select to authenticated using (
    account_id = auth.uid()
    or (visible and public.is_marketplace_user())
  );
create policy worker_profiles_write on public.worker_profiles
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy worker_availability_read on public.worker_availability
  for select to authenticated using (
    account_id = auth.uid()
    or (
      public.is_marketplace_user()
      and exists (
        select 1 from public.worker_profiles w
        where w.account_id = worker_availability.account_id and w.visible
      )
    )
  );
create policy worker_availability_write on public.worker_availability
  for all to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy gigs_read on public.gigs
  for select to authenticated using (public.is_marketplace_user());
create policy gigs_write on public.gigs
  for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy gig_applications_read on public.gig_applications
  for select to authenticated using (
    worker_id = auth.uid() or public.is_company_member(public.gig_company(gig_id))
  );
create policy gig_applications_apply on public.gig_applications
  for insert to authenticated with check (worker_id = auth.uid());
create policy gig_applications_worker_update on public.gig_applications
  for update to authenticated using (worker_id = auth.uid()) with check (worker_id = auth.uid());
create policy gig_applications_company_update on public.gig_applications
  for update to authenticated
  using (public.is_company_member(public.gig_company(gig_id)))
  with check (public.is_company_member(public.gig_company(gig_id)));

create policy gig_workers_read on public.gig_workers
  for select to authenticated using (
    worker_id = auth.uid() or public.is_company_member(public.gig_company(gig_id))
  );
create policy gig_workers_company on public.gig_workers
  for all to authenticated
  using (public.is_company_member(public.gig_company(gig_id)))
  with check (public.is_company_member(public.gig_company(gig_id)));
-- O profissional marca o próprio "cheguei" e "terminei".
create policy gig_workers_self_update on public.gig_workers
  for update to authenticated using (worker_id = auth.uid()) with check (worker_id = auth.uid());

create policy work_reviews_read on public.work_reviews
  for select to authenticated using (public.is_marketplace_user());
create policy work_reviews_write on public.work_reviews
  for insert to authenticated with check (
    author_id = auth.uid()
    and (
      exists (select 1 from public.gig_workers gw where gw.gig_id = gig_id and gw.worker_id = auth.uid())
      or public.is_company_member(public.gig_company(gig_id))
    )
  );
create policy work_reviews_update on public.work_reviews
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Fechamento: a empresa gerencia, o profissional lê o próprio acerto.
create policy payout_periods_company on public.payout_periods
  for all to authenticated
  using (public.is_company_manager(company_id))
  with check (public.is_company_manager(company_id));
create policy payout_periods_worker on public.payout_periods
  for select to authenticated using (public.member_account(member_id) = auth.uid());

create policy payout_adjustments_company on public.payout_adjustments
  for all to authenticated
  using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.is_company_manager(p.company_id)
  ))
  with check (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.is_company_manager(p.company_id)
  ));
create policy payout_adjustments_worker on public.payout_adjustments
  for select to authenticated using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.member_account(p.member_id) = auth.uid()
  ));

create policy payout_lines_company on public.payout_lines
  for all to authenticated
  using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.is_company_manager(p.company_id)
  ))
  with check (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.is_company_manager(p.company_id)
  ));
create policy payout_lines_worker on public.payout_lines
  for select to authenticated using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id and public.member_account(p.member_id) = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- Entrada por código
--
-- Quem chega com um convite ainda não enxerga a linha que vai reivindicar, então
-- a troca acontece por função: o código é a prova, e ela só preenche a conta
-- quando o lugar está mesmo vago.
-- ----------------------------------------------------------------------------
create or replace function public.claim_team_invite(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  update public.company_members
  set account_id = auth.uid()
  where invite_code = upper(btrim(_code))
    and account_id is null
    and active
  returning id into claimed;

  return claimed;
end;
$$;

create or replace function public.claim_customer_portal(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  update public.customers
  set account_id = auth.uid()
  where portal_code = upper(btrim(_code))
    and account_id is null
    and active
  returning id into claimed;

  return claimed;
end;
$$;

revoke execute on function public.claim_team_invite(text) from public, anon;
revoke execute on function public.claim_customer_portal(text) from public, anon;
grant execute on function public.claim_team_invite(text) to authenticated;
grant execute on function public.claim_customer_portal(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Storage: fotos do serviço
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

create policy job_photos_read on storage.objects
  for select to authenticated using (bucket_id = 'job-photos');
create policy job_photos_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-photos' and owner = auth.uid());
create policy job_photos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'job-photos' and owner = auth.uid());

-- ----------------------------------------------------------------------------
-- Realtime: status do serviço e chat aparecem sem recarregar
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.appointment_events;
alter publication supabase_realtime add table public.thread_messages;
alter publication supabase_realtime add table public.gig_workers;
