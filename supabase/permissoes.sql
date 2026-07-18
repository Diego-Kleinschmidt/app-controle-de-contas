-- ============================================================
-- Permissões: o ADMIN pode liberar pessoas específicas a LANÇAR.
-- Quem é liberado mexe apenas nas PRÓPRIAS contas.
-- Fixar (📌) as próprias contas fica liberado para qualquer pessoa.
-- Rode este SQL DEPOIS do multi-familias.sql.
-- ============================================================

-- 1) Coluna que marca quem pode lançar (além do admin)
alter table public.perfis
  add column if not exists pode_lancar boolean not null default false;

-- 2) Função auxiliar: pode lançar? (admin sempre pode)
create or replace function public.pode_lancar()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select admin or pode_lancar from public.perfis where id = auth.uid()),
    false
  );
$$;

-- 3) Admin pode ATUALIZAR os perfis do seu grupo (para ligar/desligar pode_lancar)
drop policy if exists "perfis admin atualiza" on public.perfis;
create policy "perfis admin atualiza" on public.perfis
  for update to authenticated
  using (public.sou_admin() and grupo_id = public.meu_grupo())
  with check (public.sou_admin() and grupo_id = public.meu_grupo());

-- 4) Regras de acesso aos lançamentos
--    - inserir: admin (qualquer responsável) OU quem pode lançar (só para si)
--    - atualizar: admin OU dono da conta (permite editar/fixar as próprias)
--    - apagar: admin OU quem pode lançar apagando a própria
drop policy if exists "inserir" on public.lancamentos;
drop policy if exists "atualizar" on public.lancamentos;
drop policy if exists "apagar" on public.lancamentos;

create policy "inserir" on public.lancamentos for insert to authenticated
with check (
  grupo_id = public.meu_grupo()
  and public.pode_lancar()
  and (public.sou_admin() or responsavel_id = auth.uid())
);

create policy "atualizar" on public.lancamentos for update to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or responsavel_id = auth.uid())
)
with check (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or responsavel_id = auth.uid())
);

create policy "apagar" on public.lancamentos for delete to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or (public.pode_lancar() and responsavel_id = auth.uid()))
);
