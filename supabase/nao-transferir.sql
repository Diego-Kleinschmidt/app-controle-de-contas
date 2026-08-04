-- ============================================================
-- Acerto de contas: marca lançamentos que FICAM NA CONTA da pessoa (ex.: um
-- empréstimo/cotas do admin lançado na conta dela só para controle).
--   nao_transferir = true  -> NÃO conta nas contas dela, NÃO aparece para ela,
--                             e não entra no valor a transferir. Só o admin vê.
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

-- 1) Coluna
alter table public.lancamentos
  add column if not exists nao_transferir boolean not null default false;

-- 2) Leitura: o usuário comum NÃO enxerga itens "não transferir" (só o admin).
drop policy if exists "ler" on public.lancamentos;
create policy "ler" on public.lancamentos for select to authenticated
using (
  grupo_id = public.meu_grupo()
  and (
    public.sou_admin()
    or (responsavel_id = auth.uid() and not nao_transferir)
  )
);
