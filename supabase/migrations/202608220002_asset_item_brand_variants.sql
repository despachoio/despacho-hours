begin;

alter table public.asset_items
  drop constraint if exists asset_items_category_id_name_key;

create unique index if not exists asset_items_category_name_brand_model_uidx
  on public.asset_items (
    category_id,
    name,
    coalesce(brand, ''),
    coalesce(model, '')
  );

commit;
