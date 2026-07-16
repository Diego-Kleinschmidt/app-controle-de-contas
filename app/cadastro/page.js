"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const campo =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function cadastrar(evento) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);

    // Verifica o código de convite antes de tentar cadastrar (erro amigável)
    const { data: valido } = await supabase.rpc("codigo_valido", {
      p_codigo: codigo.trim(),
    });
    if (!valido) {
      setCarregando(false);
      setErro("Código de convite inválido. Você precisa de um código para se cadastrar.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim(), codigo_convite: codigo.trim() } },
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
    } else if (data.session) {
      router.replace("/"); // entrou direto (sem confirmação de e-mail)
    } else {
      setErro("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl">💰</span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Criar conta
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Comece a controlar as contas da sua família
        </p>
      </div>

      <form
        onSubmit={cadastrar}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Seu nome</span>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Diego"
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="username"
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Senha</span>
          <div className="relative">
            <input
              type={mostrarSenha ? "text" : "password"}
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              className={`${campo} w-full pr-11`}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-lg"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? "🙈" : "👁️"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Código de convite
          </span>
          <input
            type="text"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Cole o código que você recebeu"
            className={campo}
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            É necessário um código para se cadastrar. Peça a quem já usa o app.
          </span>
        </label>

        {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {carregando ? "Criando…" : "Criar conta"}
        </button>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
