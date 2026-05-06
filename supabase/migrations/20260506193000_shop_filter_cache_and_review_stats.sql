begin;

create table if not exists public.shop_filter_cache (
  cache_key text primary key,
  city text not null default '',
  district text not null default '',
  category text not null default 'All',
  service_brand text not null default '',
  service_model text not null default '',
  search_query text not null default '',
  shops jsonb not null default '[]'::jsonb,
  total_count integer not null default 0,
  source text not null default 'cache',
  expires_at timestamptz not null,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_filter_cache_expires_at_idx
  on public.shop_filter_cache (expires_at);

create index if not exists shop_filter_cache_locked_until_idx
  on public.shop_filter_cache (locked_until);

create table if not exists public.shop_identity_map (
  shop_key text primary key,
  place_id text,
  shop_id text,
  shop_name text,
  shop_name_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shop_identity_map_place_id_idx
  on public.shop_identity_map (place_id)
  where place_id is not null and place_id <> '';

create unique index if not exists shop_identity_map_shop_id_idx
  on public.shop_identity_map (shop_id)
  where shop_id is not null and shop_id <> '';

create index if not exists shop_identity_map_shop_name_key_idx
  on public.shop_identity_map (shop_name_key)
  where shop_name_key is not null and shop_name_key <> '';

create table if not exists public.shop_review_stats (
  shop_key text primary key,
  place_id text,
  shop_id text,
  shop_name text,
  shop_name_key text,
  app_review_count integer not null default 0,
  app_average_rating numeric(4, 2),
  display_rating numeric(4, 2),
  display_review_count integer not null default 0,
  one_star_count integer not null default 0,
  min_rating numeric(4, 2),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_details_cache (
  shop_key text primary key,
  place_id text,
  details jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_details_cache_place_id_idx
  on public.shop_details_cache (place_id)
  where place_id is not null and place_id <> '';

create index if not exists shop_details_cache_expires_at_idx
  on public.shop_details_cache (expires_at);

create index if not exists shop_review_stats_place_id_idx
  on public.shop_review_stats (place_id)
  where place_id is not null and place_id <> '';

create index if not exists shop_review_stats_shop_id_idx
  on public.shop_review_stats (shop_id)
  where shop_id is not null and shop_id <> '';

create index if not exists shop_review_stats_shop_name_key_idx
  on public.shop_review_stats (shop_name_key)
  where shop_name_key is not null and shop_name_key <> '';

create or replace function public.normalize_shop_cache_text(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '\s+', ' ', 'g')
$$;

create or replace function public.normalize_shop_filter_cache_key(
  p_city text,
  p_district text,
  p_category text,
  p_service_brand text default '',
  p_service_model text default '',
  p_search_query text default ''
)
returns text
language sql
immutable
as $$
  select concat_ws(
    '|',
    public.normalize_shop_cache_text(p_city),
    public.normalize_shop_cache_text(p_district),
    public.normalize_shop_cache_text(coalesce(nullif(p_category, ''), 'All')),
    public.normalize_shop_cache_text(p_service_brand),
    public.normalize_shop_cache_text(p_service_model),
    public.normalize_shop_cache_text(p_search_query)
  )
$$;

create or replace function public.normalize_shop_name_key(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(public.normalize_shop_cache_text(p_value), '[^a-z0-9]+', ' ', 'g')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_filter_cache_set_updated_at on public.shop_filter_cache;
create trigger shop_filter_cache_set_updated_at
before update on public.shop_filter_cache
for each row execute function public.set_updated_at();

drop trigger if exists shop_identity_map_set_updated_at on public.shop_identity_map;
create trigger shop_identity_map_set_updated_at
before update on public.shop_identity_map
for each row execute function public.set_updated_at();

drop trigger if exists shop_details_cache_set_updated_at on public.shop_details_cache;
create trigger shop_details_cache_set_updated_at
before update on public.shop_details_cache
for each row execute function public.set_updated_at();

create or replace function public.get_cached_shop_filter(
  p_city text,
  p_district text,
  p_category text,
  p_service_brand text default '',
  p_service_model text default '',
  p_search_query text default ''
)
returns table (
  cache_key text,
  shops jsonb,
  total_count integer,
  source text,
  cache_status text,
  cache_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache_key text;
begin
  v_cache_key := public.normalize_shop_filter_cache_key(
    p_city,
    p_district,
    p_category,
    p_service_brand,
    p_service_model,
    p_search_query
  );

  return query
  select
    c.cache_key,
    c.shops,
    c.total_count,
    c.source,
    case
      when c.expires_at > now() then 'hit'
      when c.locked_until is not null and c.locked_until > now() then 'stale_refreshing'
      else 'expired'
    end as cache_status,
    c.expires_at as cache_expires_at
  from public.shop_filter_cache c
  where c.cache_key = v_cache_key
    and (
      c.expires_at > now()
      or (c.locked_until is not null and c.locked_until > now() and jsonb_array_length(c.shops) > 0)
    )
  limit 1;
end;
$$;

create or replace function public.try_lock_shop_filter_cache(
  p_city text,
  p_district text,
  p_category text,
  p_service_brand text default '',
  p_service_model text default '',
  p_search_query text default '',
  p_lock_seconds integer default 90
)
returns table (
  cache_key text,
  lock_acquired boolean,
  stale_shops jsonb,
  total_count integer,
  cache_status text,
  cache_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache_key text;
  v_lock_until timestamptz;
begin
  v_cache_key := public.normalize_shop_filter_cache_key(
    p_city,
    p_district,
    p_category,
    p_service_brand,
    p_service_model,
    p_search_query
  );
  v_lock_until := now() + make_interval(secs => greatest(1, coalesce(p_lock_seconds, 90)));

  insert into public.shop_filter_cache (
    cache_key,
    city,
    district,
    category,
    service_brand,
    service_model,
    search_query,
    expires_at,
    locked_until
  )
  values (
    v_cache_key,
    coalesce(p_city, ''),
    coalesce(p_district, ''),
    coalesce(nullif(p_category, ''), 'All'),
    coalesce(p_service_brand, ''),
    coalesce(p_service_model, ''),
    coalesce(p_search_query, ''),
    now() - interval '1 second',
    v_lock_until
  )
  on conflict (cache_key) do nothing;

  update public.shop_filter_cache c
  set locked_until = v_lock_until
  where c.cache_key = v_cache_key
    and (c.locked_until is null or c.locked_until < now());

  return query
  select
    c.cache_key,
    c.locked_until = v_lock_until as lock_acquired,
    c.shops as stale_shops,
    c.total_count,
    case
      when c.expires_at > now() then 'hit'
      when c.locked_until = v_lock_until then 'lock_acquired'
      when jsonb_array_length(c.shops) > 0 then 'stale_refreshing'
      else 'miss'
    end as cache_status,
    c.expires_at as cache_expires_at
  from public.shop_filter_cache c
  where c.cache_key = v_cache_key
  limit 1;
end;
$$;

create or replace function public.save_shop_filter_cache(
  p_cache_key text,
  p_city text,
  p_district text,
  p_category text,
  p_service_brand text default '',
  p_service_model text default '',
  p_search_query text default '',
  p_shops jsonb default '[]'::jsonb,
  p_total_count integer default 0,
  p_source text default 'google'
)
returns table (
  cache_key text,
  cache_status text,
  cache_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cache_key text;
begin
  v_cache_key := coalesce(
    nullif(p_cache_key, ''),
    public.normalize_shop_filter_cache_key(
      p_city,
      p_district,
      p_category,
      p_service_brand,
      p_service_model,
      p_search_query
    )
  );

  insert into public.shop_filter_cache (
    cache_key,
    city,
    district,
    category,
    service_brand,
    service_model,
    search_query,
    shops,
    total_count,
    source,
    expires_at,
    locked_until
  )
  values (
    v_cache_key,
    coalesce(p_city, ''),
    coalesce(p_district, ''),
    coalesce(nullif(p_category, ''), 'All'),
    coalesce(p_service_brand, ''),
    coalesce(p_service_model, ''),
    coalesce(p_search_query, ''),
    coalesce(p_shops, '[]'::jsonb),
    greatest(0, coalesce(p_total_count, 0)),
    coalesce(nullif(p_source, ''), 'google'),
    now() + interval '30 days',
    null
  )
  on conflict (cache_key) do update set
    city = excluded.city,
    district = excluded.district,
    category = excluded.category,
    service_brand = excluded.service_brand,
    service_model = excluded.service_model,
    search_query = excluded.search_query,
    shops = excluded.shops,
    total_count = excluded.total_count,
    source = excluded.source,
    expires_at = excluded.expires_at,
    locked_until = null;

  return query
  select c.cache_key, 'saved'::text, c.expires_at
  from public.shop_filter_cache c
  where c.cache_key = v_cache_key;
end;
$$;

create or replace function public.get_public_shop_review_stats(
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  shop_key text,
  place_id text,
  shop_id text,
  shop_name text,
  shop_name_key text,
  app_review_count integer,
  app_average_rating numeric,
  display_rating numeric,
  display_review_count integer,
  one_star_count integer,
  min_rating numeric,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.shop_key,
    s.place_id,
    s.shop_id,
    s.shop_name,
    s.shop_name_key,
    s.app_review_count,
    s.app_average_rating,
    s.display_rating,
    s.display_review_count,
    s.one_star_count,
    s.min_rating,
    s.updated_at
  from public.shop_review_stats s
  where s.display_review_count > 0
  order by s.updated_at desc, s.shop_key
  limit greatest(1, least(coalesce(p_limit, 1000), 5000))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.get_cached_shop_details(p_shop_keys text[])
returns table (
  shop_key text,
  place_id text,
  details jsonb,
  cache_expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    d.shop_key,
    d.place_id,
    d.details,
    d.expires_at
  from public.shop_details_cache d
  where d.expires_at > now()
    and (
      d.shop_key = any(coalesce(p_shop_keys, array[]::text[]))
      or d.place_id = any(coalesce(p_shop_keys, array[]::text[]))
    );
$$;

create or replace function public.save_shop_details_cache(
  p_shop_key text,
  p_place_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_key text;
begin
  v_shop_key := coalesce(nullif(p_shop_key, ''), nullif(p_place_id, ''));
  if v_shop_key is null then
    raise exception 'shop key is required';
  end if;

  insert into public.shop_details_cache (shop_key, place_id, details, expires_at)
  values (v_shop_key, nullif(p_place_id, ''), coalesce(p_details, '{}'::jsonb), now() + interval '30 days')
  on conflict (shop_key) do update set
    place_id = coalesce(excluded.place_id, public.shop_details_cache.place_id),
    details = excluded.details,
    expires_at = excluded.expires_at,
    updated_at = now();
end;
$$;

create or replace function public.upsert_shop_review_stats(
  p_shop_key text,
  p_place_id text default null,
  p_shop_id text default null,
  p_shop_name text default null,
  p_app_review_count integer default 0,
  p_app_average_rating numeric default null,
  p_display_rating numeric default null,
  p_display_review_count integer default 0,
  p_one_star_count integer default 0,
  p_min_rating numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_key text;
  v_shop_name_key text;
begin
  v_shop_key := coalesce(nullif(p_shop_key, ''), nullif(p_place_id, ''), nullif(p_shop_id, ''));
  if v_shop_key is null then
    raise exception 'shop key is required';
  end if;
  v_shop_name_key := public.normalize_shop_name_key(p_shop_name);

  insert into public.shop_identity_map (shop_key, place_id, shop_id, shop_name, shop_name_key)
  values (v_shop_key, nullif(p_place_id, ''), nullif(p_shop_id, ''), nullif(p_shop_name, ''), nullif(v_shop_name_key, ''))
  on conflict (shop_key) do update set
    place_id = coalesce(excluded.place_id, public.shop_identity_map.place_id),
    shop_id = coalesce(excluded.shop_id, public.shop_identity_map.shop_id),
    shop_name = coalesce(excluded.shop_name, public.shop_identity_map.shop_name),
    shop_name_key = coalesce(excluded.shop_name_key, public.shop_identity_map.shop_name_key);

  insert into public.shop_review_stats (
    shop_key,
    place_id,
    shop_id,
    shop_name,
    shop_name_key,
    app_review_count,
    app_average_rating,
    display_rating,
    display_review_count,
    one_star_count,
    min_rating
  )
  values (
    v_shop_key,
    nullif(p_place_id, ''),
    nullif(p_shop_id, ''),
    nullif(p_shop_name, ''),
    nullif(v_shop_name_key, ''),
    greatest(0, coalesce(p_app_review_count, 0)),
    p_app_average_rating,
    p_display_rating,
    greatest(0, coalesce(p_display_review_count, p_app_review_count, 0)),
    greatest(0, coalesce(p_one_star_count, 0)),
    p_min_rating
  )
  on conflict (shop_key) do update set
    place_id = coalesce(excluded.place_id, public.shop_review_stats.place_id),
    shop_id = coalesce(excluded.shop_id, public.shop_review_stats.shop_id),
    shop_name = coalesce(excluded.shop_name, public.shop_review_stats.shop_name),
    shop_name_key = coalesce(excluded.shop_name_key, public.shop_review_stats.shop_name_key),
    app_review_count = excluded.app_review_count,
    app_average_rating = excluded.app_average_rating,
    display_rating = excluded.display_rating,
    display_review_count = excluded.display_review_count,
    one_star_count = excluded.one_star_count,
    min_rating = excluded.min_rating,
    updated_at = now();
end;
$$;

alter table public.shop_filter_cache enable row level security;
alter table public.shop_identity_map enable row level security;
alter table public.shop_review_stats enable row level security;
alter table public.shop_details_cache enable row level security;

revoke all on public.shop_filter_cache from anon, authenticated;
revoke all on public.shop_identity_map from anon, authenticated;
revoke all on public.shop_review_stats from anon, authenticated;
revoke all on public.shop_details_cache from anon, authenticated;

grant execute on function public.get_cached_shop_filter(text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.try_lock_shop_filter_cache(text, text, text, text, text, text, integer) to anon, authenticated, service_role;
grant execute on function public.save_shop_filter_cache(text, text, text, text, text, text, text, jsonb, integer, text) to anon, authenticated, service_role;
grant execute on function public.get_public_shop_review_stats(integer, integer) to anon, authenticated, service_role;
grant execute on function public.get_cached_shop_details(text[]) to anon, authenticated, service_role;
grant execute on function public.save_shop_details_cache(text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.upsert_shop_review_stats(text, text, text, text, integer, numeric, numeric, integer, integer, numeric) to anon, authenticated, service_role;

comment on table public.shop_filter_cache is
  '30-day normalized filter result cache. app-shop-catalog should read this before Google/Foursquare and save fresh misses here.';

comment on table public.shop_review_stats is
  'Application-owned shop rating counters. Web cards must use these display fields instead of Google rating/review counts.';

comment on table public.shop_details_cache is
  '30-day details snapshot cache for selected catalog shops. Used to enrich list cards without Google details fan-out.';

commit;
