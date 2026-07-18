-- ============================================================
-- Registra QUEM criou cada lançamento (autoria), para que uma pessoa
-- liberada possa editar/apagar apenas o que ELA MESMA lançou.
-- O admin continua podendo tudo. Fixar (📌) segue liberado para o dono da conta.
-- Rode este SQL DEPOIS do permissoes.sql.
-- ============================================================

-- 1) Coluna de autoria
alter table public.lancamentos
  add column if not exists criado_por uuid references auth.users(id);

-- 2) Preenche o autor automaticamente no insert (junto do grupo).
--    Lançamentos ANTIGOS ficam com autor nulo de propósito: assim só o admin
--    poderá editá-los (ninguém "herda" a edição de contas que não lançou).
create or replace function public.definir_grupo_lancamento()
returns trigger language plpgsql security definer as $$
begin
  if new.grupo_id is null then
    new.grupo_id := public.meu_grupo();
  end if;
  if new.criado_por is null then
    new.criado_por := auth.uid();
  end if;
  return new;
end; $$;

-- 3) Regras de acesso
--    - atualizar: admin, OU quem CRIOU (editar), OU o dono da conta (fixar a sua)
--    - apagar: admin, OU quem CRIOU
drop policy if exists "atualizar" on public.lancamentos;
drop policy if exists "apagar" on public.lancamentos;

create policy "atualizar" on public.lancamentos for update to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid() or responsavel_id = auth.uid())
)
with check (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid() or responsavel_id = auth.uid())
);

create policy "apagar" on public.lancamentos for delete to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid())
);
