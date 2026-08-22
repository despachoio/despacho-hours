begin;

alter table public.asset_items
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists notes text;

alter table public.asset_items drop constraint if exists asset_items_item_type_check;
alter table public.asset_items add constraint asset_items_item_type_check
  check (item_type in ('durable_asset','accessory','consumable','stationery','employee_essential'));

alter table public.assets
  add column if not exists warranty_expiry date,
  add column if not exists active boolean not null default true;

alter table public.asset_assignments
  add column if not exists expected_return_date date;

create index if not exists assets_available_item_idx
  on public.assets(item_id,status) where active=true;

commit;
