# Banco de dados (Supabase)

## Para instalar do zero (conta nova / entregar para outra pessoa)

Rode **apenas** o arquivo **[`setup-completo.sql`](./setup-completo.sql)**. Ele cria
todo o banco de uma vez, no estado final (grupos, perfis, lançamentos, config,
funções, triggers, regras de acesso e permissões).

Passos rápidos:

1. Crie um projeto no Supabase.
2. SQL Editor → New query.
3. No arquivo, troque `MUDE-ESTE-CODIGO-MESTRE` pelo seu código secreto.
4. Cole tudo e clique em **Run**.
5. Authentication → Providers → Email → desative **"Confirm email"**.
6. No app, cadastre-se com o **código mestre** → você vira o admin da 1ª família.

## Arquivos de histórico (não precisa rodar)

Estes são os passos incrementais, na ordem em que foram aplicados durante o
desenvolvimento. Servem só como registro — o `setup-completo.sql` já reúne tudo:

1. `criar-tabela-lancamentos.sql` — tabela inicial de lançamentos
2. `adicionar-coluna-fixado.sql` — coluna para fixar contas no topo
3. `migracao-usuarios.sql` — perfis (usuários) + acesso por admin
4. `multi-familias.sql` — grupos (multi-família), código mestre e de convite
5. `permissoes.sql` — coluna `pode_lancar` (admin libera quem pode lançar)
6. `criado-por.sql` — autoria (`criado_por`): editar só o que a pessoa lançou
