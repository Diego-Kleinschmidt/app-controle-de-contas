-- ============================================================================
-- CONTROLE DE CONTAS — SETUP COMPLETO DO BANCO (rode UMA vez numa conta nova)
-- ============================================================================
-- Este arquivo cria TODO o banco do zero, na ordem certa. Use-o para instalar
-- o sistema numa conta Supabase nova ou para entregar o projeto a outra pessoa.
--
-- COMO USAR:
--   1. Crie um projeto no Supabase.
--   2. Abra "SQL Editor" > "New query".
--   3. AJUSTE a linha do CÓDIGO MESTRE lá embaixo (procure por >>>).
--   4. Cole tudo e clique em "Run".
--   5. Em Authentication > Providers > Email, DESATIVE "Confirm email".
--   6. No app, cadastre-se usando o CÓDIGO MESTRE: você vira o admin da 1ª família.
--
-- Depois disso, o app funciona sozinho:
--   • Código mestre (só você sabe) cria uma família nova e um admin.
--   • Código de convite de uma família deixa outra pessoa entrar nela.
--   • Admin vê/mexe em tudo; pessoas liberadas lançam só as próprias contas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) GRUPOS (cada família é um grupo, com um código de convite único)
-- ----------------------------------------------------------------------------
create table if not exists public.grupos (
  id             uuid primary key default gen_random_uuid(),
  nome           text,
  codigo_convite text unique not null,
  created_at     timestamptz not null default now()
);
alter table public.grupos enable row level security;


-- ----------------------------------------------------------------------------
-- 2) PERFIS (um por usuário: nome, se é admin, se pode lançar, e a família)
-- ----------------------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  admin       boolean not null default false,
  pode_lancar boolean not null default false,
  grupo_id    uuid references public.grupos(id)
);
alter table public.perfis enable row level security;


-- ----------------------------------------------------------------------------
-- 3) LANÇAMENTOS (as contas: receitas e despesas)
-- ----------------------------------------------------------------------------
create table if not exists public.lancamentos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('receita','despesa')),
  descricao      text not null,
  valor          numeric(10,2) not null,          -- reembolso é guardado negativo
  data           date not null,
  mes_referencia text not null,                   -- ex.: "2026-07"
  responsavel_id uuid references public.perfis(id),
  criado_por     uuid references auth.users(id),  -- quem lançou (autoria)
  fixado         boolean not null default false,
  forma          text not null default 'unica'
                   check (forma in ('unica','recorrente','parcelada')),
  parcela_atual  int,
  parcela_total  int,
  grupo_id       uuid references public.grupos(id),
  created_at     timestamptz not null default now()
);
alter table public.lancamentos enable row level security;


-- ----------------------------------------------------------------------------
-- 4) CONFIG (guarda o CÓDIGO MESTRE; RLS sem policy = só funções internas leem)
-- ----------------------------------------------------------------------------
create table if not exists public.config (
  chave text primary key,
  valor text not null
);
alter table public.config enable row level security;

-- >>> AJUSTE AQUI: troque 'MUDE-ESTE-CODIGO-MESTRE' pelo SEU código secreto.
--     É com ele que você cria famílias novas. Guarde bem.
insert into public.config (chave, valor)
  values ('codigo_mestre', 'MUDE-ESTE-CODIGO-MESTRE')
  on conflict (chave) do update set valor = excluded.valor;


-- ----------------------------------------------------------------------------
-- 5) FUNÇÕES AUXILIARES (security definer evita recursão de RLS)
-- ----------------------------------------------------------------------------
-- Qual é o meu grupo (família)?
create or replace function public.meu_grupo()
returns uuid language sql stable security definer as $$
  select grupo_id from public.perfis where id = auth.uid();
$$;

-- Sou admin?
create or replace function public.sou_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false);
$$;

-- Posso lançar? (admin sempre pode)
create or replace function public.pode_lancar()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select admin or pode_lancar from public.perfis where id = auth.uid()),
    false
  );
$$;

-- Um código é válido? (código mestre OU código de convite de uma família)
create or replace function public.codigo_valido(p_codigo text)
returns boolean language sql stable security definer as $$
  select p_codigo is not null and length(trim(p_codigo)) > 0 and (
    trim(p_codigo) = (select valor from public.config where chave = 'codigo_mestre')
    or exists (select 1 from public.grupos where codigo_convite = trim(p_codigo))
  );
$$;
grant execute on function public.codigo_valido(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6) CADASTRO: cria o perfil + família nova (código mestre) OU entra por convite
-- ----------------------------------------------------------------------------
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer as $$
declare
  v_codigo text := nullif(trim(new.raw_user_meta_data->>'codigo_convite'), '');
  v_nome   text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  v_grupo  uuid;
  v_admin  boolean;
  v_mestre text := (select valor from public.config where chave = 'codigo_mestre');
begin
  -- Código é OBRIGATÓRIO: ninguém se cadastra sem um.
  if v_codigo is null then
    raise exception 'É necessário um código de convite para se cadastrar.';
  end if;

  if v_mestre is not null and v_codigo = v_mestre then
    -- código MESTRE: cria uma família nova e vira admin
    insert into public.grupos (nome, codigo_convite)
      values (v_nome, substr(md5(random()::text), 1, 8))
      returning id into v_grupo;
    v_admin := true;
  else
    -- código de convite de uma família existente
    select id into v_grupo from public.grupos where codigo_convite = v_codigo;
    if v_grupo is null then
      raise exception 'Código de convite inválido.';
    end if;
    v_admin := false;
  end if;

  insert into public.perfis (id, nome, admin, grupo_id)
    values (new.id, v_nome, v_admin, v_grupo);
  return new;
end; $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();


-- ----------------------------------------------------------------------------
-- 7) AO INSERIR LANÇAMENTO: define o grupo e o autor automaticamente
-- ----------------------------------------------------------------------------
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

drop trigger if exists ao_inserir_lancamento on public.lancamentos;
create trigger ao_inserir_lancamento
  before insert on public.lancamentos
  for each row execute function public.definir_grupo_lancamento();


-- ----------------------------------------------------------------------------
-- 8) REGRAS DE ACESSO (RLS) — isolamento por família + permissões
-- ----------------------------------------------------------------------------
-- Perfis: leitura dentro do grupo; admin pode atualizar (ligar/desligar lançar)
drop policy if exists "perfis leitura" on public.perfis;
create policy "perfis leitura" on public.perfis
  for select to authenticated using (grupo_id = public.meu_grupo());

drop policy if exists "perfis admin atualiza" on public.perfis;
create policy "perfis admin atualiza" on public.perfis
  for update to authenticated
  using (public.sou_admin() and grupo_id = public.meu_grupo())
  with check (public.sou_admin() and grupo_id = public.meu_grupo());

-- Grupos: cada um só enxerga a própria família
drop policy if exists "grupos leitura" on public.grupos;
create policy "grupos leitura" on public.grupos
  for select to authenticated using (id = public.meu_grupo());

-- Lançamentos
drop policy if exists "ler" on public.lancamentos;
drop policy if exists "inserir" on public.lancamentos;
drop policy if exists "atualizar" on public.lancamentos;
drop policy if exists "apagar" on public.lancamentos;

-- Ler: dentro do grupo; admin vê tudo, os demais só as próprias contas
create policy "ler" on public.lancamentos for select to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or responsavel_id = auth.uid())
);

-- Inserir: admin (qualquer responsável) OU quem pode lançar (só para si)
create policy "inserir" on public.lancamentos for insert to authenticated
with check (
  grupo_id = public.meu_grupo()
  and public.pode_lancar()
  and (public.sou_admin() or responsavel_id = auth.uid())
);

-- Atualizar: admin, OU quem CRIOU (editar), OU o dono da conta (fixar a sua)
create policy "atualizar" on public.lancamentos for update to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid() or responsavel_id = auth.uid())
)
with check (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid() or responsavel_id = auth.uid())
);

-- Apagar: admin OU quem CRIOU
create policy "apagar" on public.lancamentos for delete to authenticated
using (
  grupo_id = public.meu_grupo()
  and (public.sou_admin() or criado_por = auth.uid())
);

-- ============================================================================
-- FIM. Agora desative "Confirm email" e cadastre-se com o código mestre.
-- ============================================================================
