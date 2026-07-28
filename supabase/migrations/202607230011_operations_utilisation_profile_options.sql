begin;

alter table public.employees
  drop constraint if exists employees_title_check;

update public.employees
set title = case title
  when 'Mr' then 'Mr.'
  when 'Miss' then 'Ms.'
  else title
end
where title in ('Mr', 'Miss');

alter table public.employees
  add constraint employees_title_check
    check (title is null or title in ('Mr.', 'Ms.', 'Mrs.', 'Dr')),
  drop constraint if exists employees_department_check,
  add constraint employees_department_check
    check (
      department is null
      or department in ('Operations', 'Admin', 'HR', 'Finance', 'Management')
    ) not valid;

commit;
