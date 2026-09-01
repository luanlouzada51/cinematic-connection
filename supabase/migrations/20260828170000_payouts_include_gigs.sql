-- =============================================================================
-- O acerto passa a enxergar o mercado de trabalho
--
-- Até aqui o relatório de pagamento só somava as casas da agenda. Quem foi
-- contratado por uma vaga ficava de fora — inclusive o profissional de fora da
-- equipe, que sequer podia ter um acerto, porque o período era amarrado a uma
-- linha de company_members.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- O que a vaga rendeu e quem ficou com o dinheiro
--
-- Sem isso, um combinado de porcentagem no mercado não tem base de cálculo: a
-- vaga guarda o percentual, mas não o valor das casas daquele dia.
-- ----------------------------------------------------------------------------
alter table public.gig_workers
  add column house_revenue numeric(10, 2) not null default 0 check (house_revenue >= 0),
  add column collected_by public.payment_collector not null default 'unpaid';

comment on column public.gig_workers.house_revenue is
  'Valor das casas feitas neste trabalho. Base da porcentagem combinada na vaga.';
comment on column public.gig_workers.collected_by is
  'Quem recebeu esse valor: ninguém ainda, a empresa, ou o profissional na casa.';

-- ----------------------------------------------------------------------------
-- Acerto para quem não é da equipe
-- ----------------------------------------------------------------------------
alter table public.payout_periods
  alter column member_id drop not null;

alter table public.payout_periods
  add column worker_account_id uuid references public.accounts (id) on delete cascade;

-- Um acerto é sempre de uma pessoa só: ou alguém da equipe, ou alguém do mercado.
alter table public.payout_periods
  add constraint payout_periods_subject_check check (
    (member_id is not null and worker_account_id is null)
    or (member_id is null and worker_account_id is not null)
  );

create index payout_periods_worker_idx on public.payout_periods (worker_account_id);

-- Uma linha do acerto agora pode vir de uma casa da agenda ou de uma vaga.
alter table public.payout_lines
  add column gig_id uuid references public.gigs (id) on delete set null;

-- ----------------------------------------------------------------------------
-- RLS: o profissional do mercado lê o próprio acerto
-- ----------------------------------------------------------------------------
drop policy payout_periods_worker on public.payout_periods;
create policy payout_periods_worker on public.payout_periods
  for select to authenticated using (
    public.member_account(member_id) = auth.uid()
    or worker_account_id = auth.uid()
  );

drop policy payout_adjustments_worker on public.payout_adjustments;
create policy payout_adjustments_worker on public.payout_adjustments
  for select to authenticated using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id
      and (public.member_account(p.member_id) = auth.uid() or p.worker_account_id = auth.uid())
  ));

drop policy payout_lines_worker on public.payout_lines;
create policy payout_lines_worker on public.payout_lines
  for select to authenticated using (exists (
    select 1 from public.payout_periods p
    where p.id = period_id
      and (public.member_account(p.member_id) = auth.uid() or p.worker_account_id = auth.uid())
  ));
