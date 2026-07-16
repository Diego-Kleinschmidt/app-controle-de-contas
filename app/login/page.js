"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha incorretos.");
    } else {
      router.replace("/"); // entrou: vai para o painel
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl">💰</span>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Controle de Contas
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Entre com seu e-mail e senha
        </p>
      </div>

      <form
        onSubmit={entrar}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            E-mail
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="username"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Senha
          </span>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}
