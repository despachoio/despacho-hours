begin;

alter table public.project_hour_transactions enable row level security;

-- Replace the overlapping legacy policies with one explicit read boundary and
-- separate write policies. Employees continue to see their assigned project
-- cards, but cannot read the wallet ledger. Managers retain read-only wallet
-- access. Only the three administrative roles may submit wallet mutations.
drop policy if exists "Admins can manage wallet transactions"
  on public.project_hour_transactions;
drop policy if exists "Employees can view assigned project wallet"
  on public.project_hour_transactions;
drop policy if exists "Managers can view wallet transactions"
  on public.project_hour_transactions;
drop policy if exists project_hour_transactions_super_admin_all
  on public.project_hour_transactions;
drop policy if exists project_hour_transactions_authorized_read
  on public.project_hour_transactions;
drop policy if exists project_hour_transactions_admin_insert
  on public.project_hour_transactions;
drop policy if exists project_hour_transactions_admin_update
  on public.project_hour_transactions;
drop policy if exists project_hour_transactions_admin_delete
  on public.project_hour_transactions;

create policy project_hour_transactions_authorized_read
on public.project_hour_transactions for select to authenticated
using (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin',
    'manager'
  )
);

create policy project_hour_transactions_admin_insert
on public.project_hour_transactions for insert to authenticated
with check (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin'
  )
);

create policy project_hour_transactions_admin_update
on public.project_hour_transactions for update to authenticated
using (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin'
  )
)
with check (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin'
  )
);

create policy project_hour_transactions_admin_delete
on public.project_hour_transactions for delete to authenticated
using (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin'
  )
);

comment on table public.project_hour_transactions is
  'Wallet ledger: Manager read-only; Finance Admin, Super Admin, and Admin may manage; Employee access is denied.';

commit;
