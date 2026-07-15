-- ============================================================
-- Marca um usuário como "mãe": no app, ele passa a ver SOMENTE
-- as contas dela (sem filtros e sem botões de administração).
--
-- Passos:
--  1) Antes, crie o usuário da mãe em Authentication > Users > Add user
--     (com e-mail e senha, marcando "Auto Confirm User").
--  2) Troque o e-mail abaixo pelo e-mail que você cadastrou para ela.
--  3) Rode no SQL Editor.
--
-- Para o SEU usuário (Diego), não precisa fazer nada: sem essa etiqueta,
-- a conta é tratada como administrador (vê tudo).
-- ============================================================

update auth.users
set raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb) || '{"pessoa":"mae"}'::jsonb
where email = 'EMAIL_DA_MAE_AQUI';
