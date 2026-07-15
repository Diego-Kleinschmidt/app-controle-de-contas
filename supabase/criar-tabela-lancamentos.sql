-- ============================================================
-- Cria a tabela "lancamentos" (as contas da família)
-- Rode este comando no Supabase: menu "SQL Editor" > "New query"
-- ============================================================

create table public.lancamentos (
  id             uuid primary key default gen_random_uuid(),   -- identificador único (automático)
  user_id        uuid not null default auth.uid(),             -- quem estava logado ao lançar
  tipo           text not null check (tipo in ('receita','despesa')),
  descricao      text not null,                                -- ex.: "Conta de luz"
  valor          numeric(10,2) not null,                       -- valor em reais
  data           date not null,                                -- dia da conta / vencimento
  mes_referencia text not null,                                -- a qual mês pertence (ex.: "2026-07")
  responsavel    text check (responsavel in ('diego','mae')),  -- de quem é o gasto
  forma          text not null default 'unica'
                   check (forma in ('unica','recorrente','parcelada')),
  parcela_atual  int,                                          -- só quando for "parcelada"
  parcela_total  int,                                          -- só quando for "parcelada"
  created_at     timestamptz not null default now()            -- quando foi criada (automático)
);

-- ============================================================
-- Segurança (RLS): só quem está logado acessa os dados.
-- OBS (MVP): por enquanto qualquer usuário logado vê tudo — combina com o
-- uso familiar compartilhado. Antes de colocar dados reais/publicar,
-- vamos restringir aos e-mails da família (Diego + mãe).
-- ============================================================

alter table public.lancamentos enable row level security;

create policy "familia pode ler"      on public.lancamentos
  for select to authenticated using (true);

create policy "familia pode inserir"  on public.lancamentos
  for insert to authenticated with check (true);

create policy "familia pode atualizar" on public.lancamentos
  for update to authenticated using (true) with check (true);

create policy "familia pode apagar"   on public.lancamentos
  for delete to authenticated using (true);
