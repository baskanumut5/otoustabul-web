begin;

create or replace function public.comment_rating_score(
  p_price_rating integer,
  p_satisfaction_rating integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select (
    least(greatest(coalesce(p_price_rating, 3), 1), 5)::numeric +
    least(greatest(coalesce(p_satisfaction_rating, 3), 1), 5)::numeric
  ) / 2.0;
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
  v_details jsonb;
begin
  v_shop_key := coalesce(nullif(p_shop_key, ''), nullif(p_place_id, ''));
  if v_shop_key is null then
    raise exception 'shop key is required';
  end if;

  v_details := jsonb_strip_nulls(coalesce(p_details, '{}'::jsonb));

  insert into public.shop_details_cache (shop_key, place_id, details, expires_at)
  values (v_shop_key, nullif(p_place_id, ''), v_details, now() + interval '30 days')
  on conflict (shop_key) do update set
    place_id = coalesce(excluded.place_id, public.shop_details_cache.place_id),
    details = jsonb_strip_nulls(public.shop_details_cache.details || excluded.details),
    expires_at = excluded.expires_at,
    updated_at = now();
end;
$$;

create or replace function public.save_shop_snapshots_cache(
  p_shops jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop jsonb;
  v_shop_key text;
  v_place_id text;
  v_saved integer := 0;
begin
  if jsonb_typeof(coalesce(p_shops, '[]'::jsonb)) <> 'array' then
    return 0;
  end if;

  for v_shop in select value from jsonb_array_elements(p_shops)
  loop
    v_place_id := coalesce(
      nullif(v_shop->>'placeId', ''),
      nullif(v_shop->>'place_id', '')
    );
    v_shop_key := coalesce(v_place_id, nullif(v_shop->>'id', ''));
    if v_shop_key is null then
      continue;
    end if;

    perform public.save_shop_details_cache(v_shop_key, v_place_id, v_shop);
    v_saved := v_saved + 1;
  end loop;

  return v_saved;
end;
$$;

create or replace function public.refresh_shop_review_stats_from_comments(
  p_shop_id text,
  p_shop_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id text := trim(coalesce(p_shop_id, ''));
  v_count integer;
  v_average numeric(6, 3);
  v_one_star_count integer;
  v_min_rating numeric(6, 3);
  v_display_rating numeric(4, 2);
  v_shop_name text;
  v_shop_name_key text;
begin
  if v_shop_id = '' then
    return;
  end if;

  select
    count(*)::integer,
    round(avg(public.comment_rating_score(c.price_rating, c.satisfaction_rating)), 3),
    count(*) filter (where public.comment_rating_score(c.price_rating, c.satisfaction_rating) <= 1.5)::integer,
    min(public.comment_rating_score(c.price_rating, c.satisfaction_rating))
  into v_count, v_average, v_one_star_count, v_min_rating
  from public.comments c
  where c.shop_id = v_shop_id
    and coalesce(c.moderation_status, 'visible') = 'visible';

  if coalesce(v_count, 0) = 0 then
    delete from public.shop_review_stats
    where shop_key = v_shop_id or place_id = v_shop_id or shop_id = v_shop_id;
    return;
  end if;

  v_shop_name := coalesce(
    nullif(p_shop_name, ''),
    (
      select nullif(d.details->>'name', '')
      from public.shop_details_cache d
      where d.shop_key = v_shop_id or d.place_id = v_shop_id
      order by d.updated_at desc
      limit 1
    )
  );
  v_shop_name_key := public.normalize_shop_name_key(v_shop_name);
  v_display_rating := round(v_average, 2);

  insert into public.shop_identity_map (shop_key, place_id, shop_id, shop_name, shop_name_key)
  values (v_shop_id, v_shop_id, v_shop_id, v_shop_name, nullif(v_shop_name_key, ''))
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
    v_shop_id,
    v_shop_id,
    v_shop_id,
    v_shop_name,
    nullif(v_shop_name_key, ''),
    v_count,
    v_average,
    v_display_rating,
    v_count,
    coalesce(v_one_star_count, 0),
    v_min_rating
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

create or replace function public.refresh_shop_comment_stats(p_shop_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_shop_id text := trim(coalesce(p_shop_id, ''));
  aggregated_count integer;
  aggregated_verified_count integer;
  aggregated_officially_verified_count integer;
  aggregated_average numeric(6, 3);
begin
  if normalized_shop_id = '' then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(c.is_verified, false))::integer,
    count(*) filter (where coalesce(c.is_officially_verified, false))::integer,
    round(avg(public.comment_rating_score(c.price_rating, c.satisfaction_rating)), 3)
  into
    aggregated_count,
    aggregated_verified_count,
    aggregated_officially_verified_count,
    aggregated_average
  from public.comments c
  where c.shop_id = normalized_shop_id
    and coalesce(c.moderation_status, 'visible') = 'visible';

  if coalesce(aggregated_count, 0) = 0 then
    delete from public.shop_comment_stats
    where shop_id = normalized_shop_id;
    perform public.refresh_shop_review_stats_from_comments(normalized_shop_id);
    return;
  end if;

  insert into public.shop_comment_stats (
    shop_id,
    comment_count,
    verified_comment_count,
    officially_verified_comment_count,
    average_rating
  ) values (
    normalized_shop_id,
    aggregated_count,
    coalesce(aggregated_verified_count, 0),
    coalesce(aggregated_officially_verified_count, 0),
    aggregated_average
  )
  on conflict (shop_id) do update
  set comment_count = excluded.comment_count,
      verified_comment_count = excluded.verified_comment_count,
      officially_verified_comment_count = excluded.officially_verified_comment_count,
      average_rating = excluded.average_rating,
      updated_at = timezone('utc', now());

  perform public.refresh_shop_review_stats_from_comments(normalized_shop_id);
end;
$$;

create or replace function public.sync_shop_review_stats_from_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_shop_review_stats_from_comments(old.shop_id);
    return old;
  end if;

  perform public.refresh_shop_review_stats_from_comments(new.shop_id);
  if tg_op = 'UPDATE' and old.shop_id is distinct from new.shop_id then
    perform public.refresh_shop_review_stats_from_comments(old.shop_id);
  end if;
  return new;
end;
$$;

drop trigger if exists comments_sync_shop_review_stats on public.comments;
create trigger comments_sync_shop_review_stats
after insert or update or delete on public.comments
for each row execute function public.sync_shop_review_stats_from_comments();

do $$
declare
  v_shop record;
begin
  for v_shop in
    select distinct shop_id
    from public.comments
    where nullif(shop_id, '') is not null
  loop
    perform public.refresh_shop_comment_stats(v_shop.shop_id);
  end loop;
end;
$$;

grant execute on function public.save_shop_snapshots_cache(jsonb) to anon, authenticated, service_role;
grant execute on function public.refresh_shop_review_stats_from_comments(text, text) to anon, authenticated, service_role;

commit;
