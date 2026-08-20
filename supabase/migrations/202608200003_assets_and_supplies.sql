begin;

create table if not exists public.asset_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  description text, active boolean not null default true, display_order integer not null default 0,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.asset_request_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  active boolean not null default true, system_locked boolean not null default false,
  display_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.asset_items (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.asset_categories(id) on delete restrict,
  name text not null, item_type text not null check (item_type in ('durable_asset','accessory','consumable','stationery')),
  stock_tracked boolean not null default false, individually_tracked boolean not null default false,
  current_stock integer not null default 0 check (current_stock >= 0), minimum_stock_level integer not null default 0 check (minimum_stock_level >= 0),
  requires_approval boolean not null default true, replacement_item_id uuid references public.asset_items(id) on delete set null,
  active boolean not null default true, display_order integer not null default 0,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(category_id,name)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.asset_items(id) on delete restrict,
  brand text, model text, serial_number text unique, asset_tag text not null unique,
  purchased_at date, condition text not null default 'good' check (condition in ('new','good','fair','damaged')),
  status text not null default 'available' check (status in ('assigned','available','under_repair','lost','damaged','returned','retired')),
  notes text, created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.asset_requests (
  id uuid primary key default gen_random_uuid(), request_code text not null unique,
  employee_id uuid not null references public.employees(id) on delete restrict,
  category_id uuid not null references public.asset_categories(id) on delete restrict,
  item_id uuid not null references public.asset_items(id) on delete restrict,
  request_type_id uuid not null references public.asset_request_types(id) on delete restrict,
  quantity_requested integer not null default 1 check (quantity_requested > 0), quantity_approved integer check (quantity_approved > 0),
  reason text not null, comments text, existing_asset_id uuid references public.assets(id) on delete set null,
  selected_asset_id uuid references public.assets(id) on delete set null,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','awaiting_issue','issued','cancelled','under_repair','completed')),
  admin_comment text, previous_id_deactivated boolean not null default false,
  approved_by uuid references auth.users(id), approved_at timestamptz, issued_by uuid references auth.users(id), issued_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create sequence if not exists public.asset_request_code_seq start 1001;

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(), asset_id uuid not null references public.assets(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  request_id uuid references public.asset_requests(id) on delete set null,
  replaced_assignment_id uuid references public.asset_assignments(id) on delete set null,
  issued_date date not null default current_date, returned_date date,
  condition_at_issue text not null default 'good', condition_at_return text,
  status text not null default 'assigned' check (status in ('assigned','returned','replaced')),
  notes text, assigned_by uuid references auth.users(id), returned_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists asset_assignments_one_active_idx on public.asset_assignments(asset_id) where status='assigned';

create table if not exists public.asset_request_history (
  id bigint generated always as identity primary key, request_id uuid not null references public.asset_requests(id) on delete cascade,
  action text not null, old_status text, new_status text, actor_user_id uuid not null references auth.users(id),
  comment text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id bigint generated always as identity primary key, item_id uuid not null references public.asset_items(id) on delete restrict,
  request_id uuid references public.asset_requests(id) on delete set null,
  transaction_type text not null check (transaction_type in ('initial','adjustment','issue','return')),
  quantity_delta integer not null, balance_after integer not null check (balance_after >= 0),
  actor_user_id uuid not null references auth.users(id), notes text, created_at timestamptz not null default now()
);

create table if not exists public.asset_audit_log (
  id bigint generated always as identity primary key, entity_type text not null, entity_id uuid,
  employee_id uuid references public.employees(id) on delete set null, request_id uuid references public.asset_requests(id) on delete set null,
  action text not null, old_value jsonb, new_value jsonb, actor_user_id uuid not null references auth.users(id),
  actor_role text not null, notes text, created_at timestamptz not null default now()
);

create index if not exists asset_requests_employee_idx on public.asset_requests(employee_id,created_at desc);
create index if not exists asset_requests_status_idx on public.asset_requests(status,created_at desc);
create index if not exists asset_assignments_employee_idx on public.asset_assignments(employee_id,status);
create index if not exists asset_history_request_idx on public.asset_request_history(request_id,created_at);

insert into public.asset_categories(name,description,display_order) values
('IT Accessories','Technology equipment and accessories',10),('Office Supplies','Stationery and workplace supplies',20),('Employee Essentials','Company-issued employee essentials',30)
on conflict(name) do nothing;
insert into public.asset_request_types(code,name,system_locked,display_order) values
('new_issue','New Issue',true,10),('replacement','Replacement',true,20),('repair','Repair',true,30),('consumable','Consumable',true,40),('lost_damaged_replacement','Lost / Damaged Replacement',true,50)
on conflict(code) do nothing;

with seeded(category,item_name,item_type,stocked,individual,ordering) as (values
('IT Accessories','Laptop','durable_asset',false,true,1),('IT Accessories','Headset','accessory',true,false,2),
('IT Accessories','Headset Replacement','accessory',true,false,3),('IT Accessories','Mouse','accessory',true,false,4),
('IT Accessories','Mouse Replacement','accessory',true,false,5),('IT Accessories','Mouse Wire Replacement','accessory',true,false,6),
('IT Accessories','Headphone Sponge Replacement','consumable',true,false,7),('IT Accessories','Laptop Charger','accessory',true,false,8),
('IT Accessories','Laptop Adapter','accessory',true,false,9),('IT Accessories','Keyboard','accessory',true,false,10),
('IT Accessories','USB Cable','accessory',true,false,11),('IT Accessories','Other IT Accessory','accessory',false,false,12),
('Office Supplies','Pen','stationery',true,false,1),('Office Supplies','Notepad','stationery',true,false,2),
('Office Supplies','Notebook','stationery',true,false,3),('Office Supplies','Bag','accessory',true,false,4),
('Office Supplies','Water Bottle','consumable',true,false,5),('Office Supplies','Coffee Mug','consumable',true,false,6),
('Employee Essentials','ID Card','accessory',false,false,1),('Employee Essentials','ID Card Replacement','accessory',false,false,2),
('Employee Essentials','Lanyard','consumable',true,false,3),('Office Supplies','Other Stationery / Supply','stationery',false,false,7)
)
insert into public.asset_items(category_id,name,item_type,stock_tracked,individually_tracked,display_order)
select c.id,s.item_name,s.item_type,s.stocked,s.individual,s.ordering from seeded s join public.asset_categories c on c.name=s.category
on conflict(category_id,name) do nothing;

create or replace function public.asset_is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select public.get_my_actual_role() in ('finance admin','super admin','admin')
$$;
revoke all on function public.asset_is_admin() from public,anon;
grant execute on function public.asset_is_admin() to authenticated,service_role;

alter table public.asset_categories enable row level security;
alter table public.asset_request_types enable row level security;
alter table public.asset_items enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_requests enable row level security;
alter table public.asset_request_history enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.asset_audit_log enable row level security;

create policy asset_catalog_read on public.asset_categories for select to authenticated using (active or public.asset_is_admin());
create policy asset_request_types_read on public.asset_request_types for select to authenticated using (active or public.asset_is_admin());
create policy asset_items_read on public.asset_items for select to authenticated using (active or public.asset_is_admin());
create policy asset_admin_categories on public.asset_categories for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy asset_admin_request_types on public.asset_request_types for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy asset_admin_items on public.asset_items for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy assets_scoped_read on public.assets for select to authenticated using (public.asset_is_admin() or exists(select 1 from public.asset_assignments aa where aa.asset_id=assets.id and aa.employee_id=public.get_my_employee_id()));
create policy assets_admin_write on public.assets for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy assignments_scoped_read on public.asset_assignments for select to authenticated using (public.asset_is_admin() or employee_id=public.get_my_employee_id());
create policy assignments_admin_write on public.asset_assignments for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy requests_scoped_read on public.asset_requests for select to authenticated using (public.asset_is_admin() or employee_id=public.get_my_employee_id());
create policy requests_employee_insert on public.asset_requests for insert to authenticated with check (employee_id=public.get_my_employee_id() and status='pending_approval');
create policy requests_admin_write on public.asset_requests for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy request_history_scoped_read on public.asset_request_history for select to authenticated using (public.asset_is_admin() or exists(select 1 from public.asset_requests ar where ar.id=request_id and ar.employee_id=public.get_my_employee_id()));
create policy request_history_admin_write on public.asset_request_history for insert to authenticated with check (public.asset_is_admin());
create policy inventory_admin on public.inventory_transactions for all to authenticated using (public.asset_is_admin()) with check (public.asset_is_admin());
create policy audit_admin_read on public.asset_audit_log for select to authenticated using (public.asset_is_admin());

grant select on public.asset_categories,public.asset_request_types,public.asset_items,public.assets,public.asset_assignments,public.asset_requests,public.asset_request_history to authenticated;
grant insert on public.asset_requests to authenticated;
grant insert,update,delete on public.asset_categories,public.asset_request_types,public.asset_items,public.assets,public.asset_assignments,public.asset_requests to authenticated;
grant insert on public.asset_request_history,public.inventory_transactions,public.asset_audit_log to authenticated;
grant usage,select on sequence public.asset_request_code_seq,public.asset_request_history_id_seq,public.inventory_transactions_id_seq,public.asset_audit_log_id_seq to authenticated;

commit;
