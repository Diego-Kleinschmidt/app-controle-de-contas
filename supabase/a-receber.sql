-- ============================================================
-- Contas "A RECEBER": você pagou por outra pessoa (pai, amigo) no seu cartão.
-- Não conta nas suas contas; fica numa lista à parte até a pessoa te pagar.
--   • terceiro  -> nome de quem vai te pagar (ex.: "Pai", "Lucas")
--   • recebido  -> true quando a pessoa já te pagou (dá baixa)
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

alter table public.lancamentos
  add column if not exists terceiro text;

alter table public.lancamentos
  add column if not exists recebido boolean not null default false;
