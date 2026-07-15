-- ============================================================
-- Adiciona a coluna "fixado" na tabela de lançamentos.
-- Serve para "fixar" uma conta no topo da lista (ex.: contas que
-- você planeja/estima e quer ver sempre em cima).
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

alter table public.lancamentos
  add column if not exists fixado boolean not null default false;
