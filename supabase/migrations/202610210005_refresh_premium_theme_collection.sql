begin;

alter table public.profiles
  drop constraint if exists profiles_preferred_theme_check;

update public.profiles
set preferred_theme = case preferred_theme
  when 'columbia-blue' then 'powder-blue'
  when 'emerald' then 'powder-blue'
  when 'pink-sand' then 'peach-whisper'
  when 'slate-grey' then 'peach-whisper'
  when 'jet-black' then 'cashmere-beige'
  when 'rose-gold' then 'cashmere-beige'
  when 'citrus' then 'soft-pistachio'
  when 'charcoal-grey' then 'soft-pistachio'
  when 'magic-mint' then 'soft-pistachio'
  else preferred_theme
end
where preferred_theme in (
  'columbia-blue', 'emerald', 'pink-sand', 'slate-grey',
  'jet-black', 'rose-gold', 'citrus', 'charcoal-grey', 'magic-mint'
);

alter table public.profiles
  add constraint profiles_preferred_theme_check check (preferred_theme in (
    'despacho-blue', 'royal-purple', 'ocean-teal', 'graphite',
    'powder-blue', 'peach-whisper', 'cashmere-beige', 'soft-pistachio'
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
    'despacho-blue', 'royal-purple', 'ocean-teal', 'graphite',
    'powder-blue', 'peach-whisper', 'cashmere-beige', 'soft-pistachio'
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
