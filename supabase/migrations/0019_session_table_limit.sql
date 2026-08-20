alter table public.sessions
  drop constraint if exists sessions_table_count_check;

alter table public.sessions
  add constraint sessions_table_count_check
  check (table_count between 1 and 99);
