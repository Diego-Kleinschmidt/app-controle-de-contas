-- ============================================================
-- LIMPAR os lançamentos (contas) para começar a usar de verdade.
-- Mantém usuários, famílias e permissões — apaga só as CONTAS.
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

delete from public.lancamentos;
