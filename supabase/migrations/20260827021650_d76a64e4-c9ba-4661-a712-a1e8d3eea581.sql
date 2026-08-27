-- Ratings: only the owner can read individual ratings
drop policy if exists "ratings readable by signed in" on public.ratings;
drop policy if exists "ratings public read" on public.ratings;
drop policy if exists "read ratings" on public.ratings;
create policy "read own ratings" on public.ratings
  for select to authenticated using (auth.uid() = user_id);

-- Achievements: only the owner
drop policy if exists "achievements readable by signed in" on public.achievements;
create policy "read own achievements" on public.achievements
  for select to authenticated using (auth.uid() = user_id);

-- Votes: only the voter
drop policy if exists "votes readable by signed in" on public.votes;
drop policy if exists "votes public read" on public.votes;
create policy "read own votes" on public.votes
  for select to authenticated using (auth.uid() = user_id);

-- List likes: only the liker; aggregate counts exposed through a function
drop policy if exists "list likes readable by signed in" on public.list_likes;
create policy "read own list likes" on public.list_likes
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.list_like_counts()
returns table (list_id uuid, likes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ll.list_id, count(*)::bigint
  from public.list_likes ll
  join public.lists l on l.id = ll.list_id
  where l.is_public or l.owner_id = auth.uid()
  group by ll.list_id
$$;
revoke execute on function public.list_like_counts() from public, anon;
grant execute on function public.list_like_counts() to authenticated;

-- Watch party members: visible to the host and to fellow participants only
drop policy if exists "watch party members readable by signed in" on public.watch_party_members;
drop policy if exists "read party members" on public.watch_party_members;
create policy "read party members" on public.watch_party_members
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.watch_parties p
      where p.id = watch_party_members.party_id and p.host_id = auth.uid()
    )
    or exists (
      select 1 from public.watch_party_members me
      where me.party_id = watch_party_members.party_id and me.user_id = auth.uid()
    )
  );

create or replace function public.watch_party_member_counts()
returns table (party_id uuid, members bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.party_id, count(*)::bigint from public.watch_party_members m group by m.party_id
$$;
revoke execute on function public.watch_party_member_counts() from public, anon;
grant execute on function public.watch_party_member_counts() to authenticated;