-- ============================================================
-- ABDUCTR -- Supabase Schema  (fresh install)
-- Run this in your Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- SHARED: auto-update updated_at on any table that has it
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
-- TABLE: leads
-- One row per contact / email.
-- company_id groups all contacts scraped from the same business.
-- ============================================================
create table if not exists public.leads (

  -- Identity
  id                  uuid          primary key default uuid_generate_v4(),
  company_id          uuid,
  company_name        text          not null,
  contact_name        text,
  role                text,

  -- Contact info
  email               text,
  email_confidence    text          check (email_confidence in ('high', 'medium', 'low')),
  email_source        text          check (email_source in ('mailto', 'regex', 'deep_crawl')),
  phone               text,
  website             text,

  -- Location
  city                text,
  state               text,
  address_full        text,

  -- Business info (from Google Maps)
  business_type       text,
  rating              numeric(2,1),
  review_count        integer,
  hours               text,

  -- Site signals (from Worker 3 crawl)
  cms                 text,
  analytics_present   boolean,
  has_contact_form    boolean,
  has_blog            boolean,
  has_email_signup    boolean,
  instagram           text,
  facebook            text,
  linkedin_url        text,

  -- AI / BANT fields
  qr_usage            boolean       default false,
  estimated_size      text          check (estimated_size in ('Small', 'Medium', 'Large')),
  budget              text          check (budget in ('Low', 'Medium', 'High')),
  authority           boolean,
  need_level          integer       check (need_level between 1 and 5),
  timing              text          check (timing in ('Immediate', '30 days', '90 days', 'Not sure')),

  -- Outreach tracking
  contacted           boolean       default false,
  date_contacted      timestamptz,
  channel             text          check (channel in ('Email', 'LinkedIn', 'Phone', 'Other')),
  response_status     text          check (response_status in ('No response', 'Interested', 'Not interested', 'Converted')),
  follow_up_date      date,
  notes               text,

  -- Tech / misc
  hosting             text,
  email_provider      text,
  location_count      text,

  -- Timestamps
  created_at          timestamptz   default now(),
  updated_at          timestamptz   default now()
);

create index if not exists leads_company_id_idx on public.leads (company_id);
create index if not exists leads_email_idx       on public.leads (lower(email));

alter table public.leads enable row level security;
create policy "Full access to leads"
  on public.leads for all to authenticated
  using (true) with check (true);

-- For local dev without auth, swap the policy above for:
-- create policy "Public access to leads" on public.leads
--   for all to anon, authenticated using (true) with check (true);

drop trigger if exists on_leads_updated on public.leads;
create trigger on_leads_updated
  before update on public.leads
  for each row execute procedure public.handle_updated_at();

-- Realtime: Dashboard -> Database -> Replication -> add "leads"
-- or: alter publication supabase_realtime add table leads;

-- ============================================================
-- TABLE: scrape_jobs
-- One row per pipeline run.
-- ============================================================
create table if not exists public.scrape_jobs (
  id                uuid          primary key default uuid_generate_v4(),
  query             text          not null,
  city              text          not null,
  status            text          check (status in ('queued', 'running', 'done', 'failed')) default 'queued',
  leads_found       integer       default 0,
  websites_fetched  integer       default 0,
  emails_found      integer       default 0,
  error_msg         text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz   default now()
);

alter table public.scrape_jobs enable row level security;
create policy "Full access to scrape_jobs"
  on public.scrape_jobs for all to authenticated
  using (true) with check (true);

-- ============================================================
-- TABLE: app_settings
-- Single-row global settings (id = 1 enforced).
-- ============================================================
create table if not exists public.app_settings (
  id                    integer       primary key default 1 check (id = 1),
  proxy_enabled         boolean       default false,
  proxy_last_refreshed  timestamptz,
  updated_at            timestamptz   default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
create policy "Full access to app_settings"
  on public.app_settings for all to authenticated
  using (true) with check (true);

-- ============================================================
-- TABLE: proxies
-- Proxy pool for Proxy Shield.
-- ============================================================
create table if not exists public.proxies (
  id            uuid          primary key default uuid_generate_v4(),
  host          text          not null,
  port          integer       not null,
  protocol      text          default 'http',
  country       text,
  last_checked  timestamptz   default now(),
  constraint proxies_host_port_unique unique (host, port)
);

alter table public.proxies enable row level security;
create policy "Full access to proxies"
  on public.proxies for all to authenticated
  using (true) with check (true);
