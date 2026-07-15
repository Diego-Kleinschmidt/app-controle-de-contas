-- ============================================================
-- Migração: o "responsável" passa a ser um USUÁRIO do sistema.
-- Cria a tabela de perfis e define o acesso de verdade (RLS):
--   • admin  -> vê e administra TODOS os lançamentos
--   • comum  -> vê SOMENTE os lançamentos atribuídos a ele
--
-- Antes de rodar: crie os usuários em Authentication > Users
-- (e-mail + senha, marcando "Auto Confirm User").
-- Rode no SQL Editor. Há 1 passo para VOCÊ ajustar (marcado com >>>).
-- ============================================================

-- 1) Tabela de perfis (um por usuário)
create table if not exists public.perfis (
  id    uuid primary key references auth.users(id) on delete cascade,
  nome  text not null,
  admin boolean not null default false
);

alter table public.perfis enable row level security;

drop policy if exists "perfis leitura" on public.perfis;
create policy "perfis leitura" on public.perfis
  for select to authenticated using (true);

-- 2) Cria um perfil automaticamente para cada novo usuário
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- 3) Cria perfis para os usuários que JÁ existem
insert into public.perfis (id, nome)
select id, coalesce(raw_user_meta_data->>'nome', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- >>> 4) AJUSTE AQUI: defina quem é admin e os nomes bonitos.
--     Troque os e-mails pelos que você cadastrou.
update public.perfis set admin = true, nome = 'Diego'
  where id = (select id from auth.users where email = 'SEU_EMAIL_AQUI');
update public.perfis set nome = 'Mãe'
  where id = (select id from auth.users where email = 'EMAIL_DA_MAE_AQUI');

-- 5) Colunas novas em lançamentos
alter table public.lancamentos
  add column if not exists responsavel_id uuid references public.perfis(id);
alter table public.lancamentos
  add column if not exists fixado boolean not null default false;

-- Limpa os dados de teste antigos (usavam texto no responsável) e remove a coluna velha.
-- Se quiser manter os lançamentos antigos, comente a linha do delete.
delete from public.lancamentos;
alter table public.lancamentos drop column if exists responsavel;

-- 6) Regras de acesso (RLS): admin vê tudo; cada um vê o seu; só admin escreve
drop policy if exists "familia pode ler" on public.lancamentos;
drop policy if exists "familia pode inserir" on public.lancamentos;
drop policy if exists "familia pode atualizar" on public.lancamentos;
drop policy if exists "familia pode apagar" on public.lancamentos;

create policy "ler" on public.lancamentos for select to authenticated
using (
  exists (select 1 from public.perfis p where p.id = auth.uid() and p.admin)
  or responsavel_id = auth.uid()
);

create policy "inserir" on public.lancamentos for insert to authenticated
with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.admin));

create policy "atualizar" on public.lancamentos for update to authenticated
using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.admin))
with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.admin));

create policy "apagar" on public.lancamentos for delete to authenticated
using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.admin));
