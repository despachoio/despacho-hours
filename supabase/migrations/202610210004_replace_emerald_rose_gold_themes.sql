begin;

-- Permit replacement identifiers before remapping retired preferences.
alter table public.profiles
  drop constraint if exists profiles_preferred_theme_check;

update public.profiles
set preferred_theme = case preferred_theme
  when 'emerald' then 'columbia-blue'
  when 'rose-gold' then 'jet-black'
  else preferred_theme
end
where preferred_theme in ('emerald', 'rose-gold');

alter table public.profiles
  add constraint profiles_preferred_theme_check check (preferred_theme in (
    'despacho-blue', 'columbia-blue', 'royal-purple', 'ocean-teal',
    'jet-black', 'graphite', 'pink-sand', 'citrus'
  ));

create or replace function public.set_my_preferred_theme(p_theme text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_theme is null or p_theme not in (
    'despacho-blue', 'columbia-blue', 'royal-purple', 'ocean-teal',
    'jet-black', 'graphite', 'pink-sand', 'citrus'
  ) then
    raise exception 'Unsupported Kairo theme';
  end if;

  update public.profiles
  set preferred_theme = p_theme
  where user_id = auth.uid();

  if not found then
    raise exception 'Authenticated profile not found';
  end if;
  return p_theme;
end;
$$;

revoke all on function public.set_my_preferred_theme(text) from public, anon;
grant execute on function public.set_my_preferred_theme(text) to authenticated, service_role;

comment on column public.profiles.preferred_theme is 'User-specific Kairo workspace theme. Does not affect official documents or emails.';

commit;
