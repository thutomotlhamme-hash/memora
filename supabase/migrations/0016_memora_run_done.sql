-- Which programme items actually ran on the day. The run-sheet marks an item
-- done when the coordinator moves on from it, and clears it if the item is moved
-- further down the running order (it hasn't happened yet).
alter table public.memora_cases add column if not exists run_done text[] not null default '{}';
