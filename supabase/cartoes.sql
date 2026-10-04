-- ============================================================
-- Cartões / meios de pagamento: cada família cadastra seus cartões (Nubank,
-- Itaú, Pix, Dinheiro...) e marca em cada lançamento qual foi usado. Assim dá
-- para AGRUPAR as contas por cartão e comparar o total com a fatura no fim do mês.
-- Só o admin cadastra/remove cartões. Vale de agora em diante: lançamentos
-- antigos ficam sem cartão (podem ser editados depois).
-- Rode no Supabase: SQL Editor > New query > cole > Run.
-- ============================================================

-- 1) Tabela de cartões (um conjunto por família)
create table if not exists public.cartoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  grupo_id   uuid references public.grupos(id),
  created_at timestamptz not null default now()
);
alter table public.cartoes enable row level security;

-- 2) Ao inserir um cartão, define a família automaticamente (como nos lançamentos)
create or replace function public.definir_grupo_cartao()
returns trigger language plpgsql security definer as $$
begin
  if new.grupo_id is null then
    new.grupo_id := public.meu_grupo();
  end if;
  return new;
end; $$;

drop trigger if exists ao_inserir_cartao on public.cartoes;
create trigger ao_inserir_cartao
  before insert on public.cartoes
  for each row execute function public.definir_grupo_cartao();

-- 3) Regras de acesso: todos da família leem; só o admin cria/edita/apaga
drop policy if exists "cartoes leitura" on public.cartoes;
create policy "cartoes leitura" on public.cartoes
  for select to authenticated using (grupo_id = public.meu_grupo());

drop policy if exists "cartoes admin escreve" on public.cartoes;
create policy "cartoes admin escreve" on public.cartoes
  for all to authenticated
  using (public.sou_admin() and grupo_id = public.meu_grupo())
  with check (public.sou_admin() and grupo_id = public.meu_grupo());

-- 4) Liga o lançamento ao cartão. Se o cartão for apagado, o lançamento
--    apenas fica "sem cartão" (não some).
alter table public.lancamentos
  add column if not exists cartao_id uuid references public.cartoes(id) on delete set null;
