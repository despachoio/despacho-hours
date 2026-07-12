create or replace function public.get_invoice_kpi_summary(p_year integer)
returns table (
  currency text,
  open_amount numeric,
  paid_amount numeric,
  overdue_count bigint,
  overdue_amount numeric,
  invoices_in_year bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    invoices.currency,
    coalesce(sum(invoices.total_amount) filter (
      where lower(invoices.status) in ('sent', 'overdue')
    ), 0)::numeric as open_amount,
    coalesce(sum(coalesce(invoices.paid_amount, invoices.total_amount)) filter (
      where lower(invoices.status) = 'paid'
    ), 0)::numeric as paid_amount,
    count(*) filter (
      where lower(invoices.status) in ('sent', 'overdue')
        and invoices.due_date < (now() at time zone 'Asia/Kolkata')::date
    ) as overdue_count,
    coalesce(sum(invoices.total_amount) filter (
      where lower(invoices.status) in ('sent', 'overdue')
        and invoices.due_date < (now() at time zone 'Asia/Kolkata')::date
    ), 0)::numeric as overdue_amount,
    count(*) filter (
      where extract(year from invoices.issue_date)::integer = p_year
        and lower(invoices.status) not in ('void', 'cancelled')
    ) as invoices_in_year
  from public.invoices
  where lower(invoices.status) not in ('void', 'cancelled')
  group by invoices.currency
  order by invoices.currency;
$$;

create or replace function public.get_invoice_monthly_summary(
  p_year integer,
  p_currency text
)
returns table (
  month_number integer,
  open_amount numeric,
  paid_amount numeric,
  total_invoiced numeric,
  invoice_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select generate_series(1, 12)::integer as month_number
  ), invoice_totals as (
    select
      extract(month from invoices.issue_date)::integer as month_number,
      coalesce(sum(invoices.total_amount) filter (
        where lower(invoices.status) in ('sent', 'overdue')
      ), 0)::numeric as open_amount,
      coalesce(sum(coalesce(invoices.paid_amount, invoices.total_amount)) filter (
        where lower(invoices.status) = 'paid'
      ), 0)::numeric as paid_amount,
      coalesce(sum(invoices.total_amount), 0)::numeric as total_invoiced,
      count(*) as invoice_count
    from public.invoices
    where extract(year from invoices.issue_date)::integer = p_year
      and invoices.currency = p_currency
      and lower(invoices.status) not in ('draft', 'void', 'cancelled')
    group by extract(month from invoices.issue_date)::integer
  )
  select
    months.month_number,
    coalesce(invoice_totals.open_amount, 0)::numeric,
    coalesce(invoice_totals.paid_amount, 0)::numeric,
    coalesce(invoice_totals.total_invoiced, 0)::numeric,
    coalesce(invoice_totals.invoice_count, 0)::bigint
  from months
  left join invoice_totals using (month_number)
  order by months.month_number;
$$;

create or replace function public.get_invoice_dashboard_dimensions()
returns table (
  invoice_year integer,
  currency text,
  invoice_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    extract(year from invoices.issue_date)::integer as invoice_year,
    invoices.currency,
    count(*) as invoice_count
  from public.invoices
  group by
    extract(year from invoices.issue_date)::integer,
    invoices.currency
  order by invoice_year desc, invoice_count desc;
$$;

grant execute on function public.get_invoice_kpi_summary(integer)
  to authenticated;

grant execute on function public.get_invoice_monthly_summary(integer, text)
  to authenticated;

grant execute on function public.get_invoice_dashboard_dimensions()
  to authenticated;

notify pgrst, 'reload schema';
