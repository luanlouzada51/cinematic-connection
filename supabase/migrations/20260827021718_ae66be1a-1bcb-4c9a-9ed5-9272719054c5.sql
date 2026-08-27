drop function if exists public.list_like_counts();
drop function if exists public.watch_party_member_counts();

alter table public.lists add column if not exists likes_count integer not null default 0;
alter table public.watch_parties add column if not exists members_count integer not null default 0;

create or replace function public.sync_list_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lists l
     set likes_count = (select count(*) from public.list_likes k where k.list_id = l.id)
   where l.id = coalesce(new.list_id, old.list_id);
  return null;
end;
$$;
revoke execute on function public.sync_list_likes_count() from public, anon, authenticated;

create or replace function public.sync_party_members_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.watch_parties p
     set members_count = (select count(*) from public.watch_party_members m where m.party_id = p.id)
   where p.id = coalesce(new.party_id, old.party_id);
  return null;
end;
$$;
revoke execute on function public.sync_party_members_count() from public, anon, authenticated;

drop trigger if exists trg_list_likes_count on public.list_likes;
create trigger trg_list_likes_count
after insert or delete on public.list_likes
for each row execute function public.sync_list_likes_count();

drop trigger if exists trg_party_members_count on public.watch_party_members;
create trigger trg_party_members_count
after insert or delete on public.watch_party_members
for each row execute function public.sync_party_members_count();

update public.lists l set likes_count = (select count(*) from public.list_likes k where k.list_id = l.id);
update public.watch_parties p set members_count = (select count(*) from public.watch_party_members m where m.party_id = p.id);