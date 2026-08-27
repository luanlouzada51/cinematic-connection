drop policy if exists "read party members" on public.watch_party_members;
create policy "read party members" on public.watch_party_members
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.watch_parties p
      where p.id = watch_party_members.party_id and p.host_id = auth.uid()
    )
  );