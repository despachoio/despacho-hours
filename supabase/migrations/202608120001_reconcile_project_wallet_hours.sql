begin;

-- The wallet ledger is the source of truth for project-hour balances. Rebuild
-- its time debits from the complete time-entry history so projects created
-- before the wallet trigger was introduced cannot retain partial utilisation.
delete from public.project_hour_transactions as transaction_row
where transaction_row.transaction_type = 'time_debit'
  and transaction_row.time_entry_id is not null
  and transaction_row.source_key is distinct from
    'time-entry:' || transaction_row.time_entry_id::text;

delete from public.project_hour_transactions as transaction_row
using public.time_entries as entry_row
where transaction_row.source_key = 'time-entry:' || entry_row.id::text
  and round(coalesce(entry_row.hours, 0)::numeric, 2) = 0;

insert into public.project_hour_transactions (
  project_id,
  time_entry_id,
  transaction_type,
  hours_delta,
  notes,
  source_key,
  created_at
)
select
  entry_row.project_id,
  entry_row.id,
  'time_debit',
  -round(entry_row.hours::numeric, 2),
  case
    when nullif(trim(coalesce(entry_row.description, '')), '') is not null
      then 'Time entry: ' || trim(entry_row.description)
    else 'Time entry hours consumed'
  end,
  'time-entry:' || entry_row.id::text,
  coalesce(
    entry_row.stopped_at,
    entry_row.started_at,
    entry_row.entry_date::timestamptz,
    now()
  )
from public.time_entries as entry_row
where round(coalesce(entry_row.hours, 0)::numeric, 2) <> 0
on conflict (source_key)
do update set
  project_id = excluded.project_id,
  time_entry_id = excluded.time_entry_id,
  transaction_type = excluded.transaction_type,
  hours_delta = excluded.hours_delta,
  notes = excluded.notes,
  created_at = excluded.created_at;

create or replace function public.sync_project_wallet(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  credited numeric(12,2);
  consumed numeric(12,2);
  available numeric(12,2);
begin
  select
    coalesce(sum(case when hours_delta > 0 then hours_delta else 0 end), 0),
    coalesce(sum(case when hours_delta < 0 then abs(hours_delta) else 0 end), 0),
    coalesce(sum(hours_delta), 0)
  into credited, consumed, available
  from public.project_hour_transactions
  where project_id = target_project_id;

  update public.projects
  set
    purchased_hours = round(credited, 2),
    used_hours = round(consumed, 2),
    remaining_hours = round(available, 2)
  where id = target_project_id;
end;
$$;

create or replace function public.handle_time_entry_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.project_hour_transactions
    where source_key = 'time-entry:' || old.id::text;

    return old;
  end if;

  if round(coalesce(new.hours, 0)::numeric, 2) = 0 then
    delete from public.project_hour_transactions
    where source_key = 'time-entry:' || new.id::text;

    return new;
  end if;

  insert into public.project_hour_transactions (
    project_id,
    time_entry_id,
    transaction_type,
    hours_delta,
    notes,
    source_key,
    created_at
  )
  values (
    new.project_id,
    new.id,
    'time_debit',
    -round(new.hours::numeric, 2),
    case
      when nullif(trim(coalesce(new.description, '')), '') is not null
        then 'Time entry: ' || trim(new.description)
      else 'Time entry hours consumed'
    end,
    'time-entry:' || new.id::text,
    coalesce(
      new.stopped_at,
      new.started_at,
      new.entry_date::timestamptz,
      now()
    )
  )
  on conflict (source_key)
  do update set
    project_id = excluded.project_id,
    time_entry_id = excluded.time_entry_id,
    transaction_type = excluded.transaction_type,
    hours_delta = excluded.hours_delta,
    notes = excluded.notes,
    created_at = excluded.created_at;

  return new;
end;
$$;

create or replace function public.handle_wallet_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_project_wallet(old.project_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    perform public.sync_project_wallet(old.project_id);
  end if;

  perform public.sync_project_wallet(new.project_id);
  return new;
end;
$$;

drop trigger if exists maintain_wallet_from_time_entries on public.time_entries;
create trigger maintain_wallet_from_time_entries
after insert or delete or update on public.time_entries
for each row execute function public.handle_time_entry_wallet();

drop trigger if exists sync_project_wallet_after_transaction
  on public.project_hour_transactions;
create trigger sync_project_wallet_after_transaction
after insert or delete or update on public.project_hour_transactions
for each row execute function public.handle_wallet_transaction_change();

-- Repair every cached project-card total after the ledger has been reconciled.
do $$
declare
  project_row record;
begin
  for project_row in select id from public.projects loop
    perform public.sync_project_wallet(project_row.id);
  end loop;
end;
$$;

comment on function public.sync_project_wallet(uuid) is
  'Synchronizes project-card purchased, used, and remaining hours from the canonical wallet ledger.';

commit;
