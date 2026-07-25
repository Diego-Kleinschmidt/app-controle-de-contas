-- ============================================================
-- Identificador único de SÉRIE (recorrente/parcelada).
-- Cada série (criada de uma vez) ganha um serie_id próprio, para que
-- editar/apagar "a série" não afete outra série igual (mesmo nome/valor).
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

-- 1) Cria a coluna
alter table public.lancamentos
  add column if not exists serie_id uuid;

-- 2) Preenche as séries que JÁ existem: agrupa por família + descrição +
--    responsável + forma, e dá um serie_id único a cada grupo.
with grupos_serie as (
  select grupo_id, descricao, responsavel_id, forma, gen_random_uuid() as sid
  from public.lancamentos
  where forma in ('recorrente', 'parcelada') and serie_id is null
  group by grupo_id, descricao, responsavel_id, forma
)
update public.lancamentos l
set serie_id = gs.sid
from grupos_serie gs
where l.serie_id is null
  and l.forma in ('recorrente', 'parcelada')
  and l.grupo_id       is not distinct from gs.grupo_id
  and l.descricao      is not distinct from gs.descricao
  and l.responsavel_id is not distinct from gs.responsavel_id
  and l.forma          =  gs.forma;
