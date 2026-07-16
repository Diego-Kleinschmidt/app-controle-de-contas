-- ============================================================
-- Multi-família (multi-tenant): cada família tem dados ISOLADOS.
-- Uma família = um "grupo", com um código de convite.
--
-- Depois de rodar este SQL, vá em Authentication > Providers > Email
-- e DESATIVE "Confirm email" (para o cadastro já entrar direto).
-- ============================================================

-- 1) Grupos (famílias), cada uma com um código de convite único
create table if not exists public.grupos (
  id             uuid primary key default gen_random_uuid(),
  nome           text,
  codigo_convite text unique not null,
  created_at     timestamptz not null default now()
);
alter table public.grupos enable row level security;

-- 2) Coluna de grupo em perfis e lançamentos
alter table public.perfis      add column if not exists grupo_id uuid references public.grupos(id);
alter table public.lancamentos add column if not exists grupo_id uuid references public.grupos(id);

-- 3) Funções auxiliares (security definer evita recursão de RLS)
create or replace function public.meu_grupo()
returns uuid language sql stable security definer as $$
  select grupo_id from public.perfis where id = auth.uid();
$$;

create or replace function public.sou_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false);
$$;

-- 4) Coloca os dados que JÁ existem em uma primeira família
do $$
declare gid uuid;
begin
  if exists (select 1 from public.perfis where grupo_id is null) then
    insert into public.grupos (nome, codigo_convite)
      values ('Minha família', substr(md5(random()::text), 1, 8))
      returning id into gid;
    update public.perfis      set grupo_id = gid where grupo_id is null;
    update public.lancamentos set grupo_id = gid where grupo_id is null;
  end if;
end $$;

-- 5) Cadastro: cria o perfil + uma família nova, OU entra por código de convite
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer as $$
declare
  v_codigo text := nullif(trim(new.raw_user_meta_data->>'codigo_convite'), '');
  v_nome   text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_grupo  uuid;
  v_admin  boolean;
begin
  if v_codigo is not null then
    select id into v_grupo from public.grupos where codigo_convite = v_codigo;
  end if;

  if v_grupo is null then
    -- sem código válido: cria uma família nova e a pessoa vira admin
    insert into public.grupos (nome, codigo_convite)
      values (v_nome, substr(md5(random()::text), 1, 8))
      returning id into v_grupo;
    v_admin := true;
  else
    v_admin := false; -- entrou numa família existente
  end if;

  insert into public.perfis (id, nome, admin, grupo_id)
    values (new.id, v_nome, v_admin, v_grupo)
    on conflict (id) do nothing;
  return new;
end; $$;

-- 6) Preenche o grupo do lançamento automaticamente ao inserir
create or replace function public.definir_grupo_lancamento()
returns trigger language plpgsql security definer as $$
begin
  if new.grupo_id is null then
    new.grupo_id := public.meu_grupo();
  end if;
  return new;
end; $$;

drop trigger if exists ao_inserir_lancamento on public.lancamentos;
create trigger ao_inserir_lancamento
  before insert on public.lancamentos
  for each row execute function public.definir_grupo_lancamento();

-- 7) Regras de acesso por grupo (RLS)
drop policy if exists "perfis leitura" on public.perfis;
create policy "perfis leitura" on public.perfis
  for select to authenticated using (grupo_id = public.meu_grupo());

drop policy if exists "grupos leitura" on public.grupos;
create policy "grupos leitura" on public.grupos
  for select to authenticated using (id = public.meu_grupo());

drop policy if exists "ler" on public.lancamentos;
drop policy if exists "inserir" on public.lancamentos;
drop policy if exists "atualizar" on public.lancamentos;
drop policy if exists "apagar" on public.lancamentos;

create policy "ler" on public.lancamentos for select to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or responsavel_id = auth.uid())
);
create policy "inserir" on public.lancamentos for insert to authenticated
with check (public.sou_admin() and grupo_id = public.meu_grupo());
create policy "atualizar" on public.lancamentos for update to authenticated
using (public.sou_admin() and grupo_id = public.meu_grupo())
with check (public.sou_admin() and grupo_id = public.meu_grupo());
create policy "apagar" on public.lancamentos for delete to authenticated
using (public.sou_admin() and grupo_id = public.meu_grupo());
