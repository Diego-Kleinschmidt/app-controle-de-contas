"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(evento) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);

    // Envia um link de acesso para o e-mail digitado
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
    } else {
      setEnviado(true);
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
          Entre com seu e-mail para acessar
        </p>
      </div>

      {enviado ? (
        // Mensagem depois que o link é enviado
        <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-4xl">📧</p>
          <p className="mt-3 font-medium text-emerald-800 dark:text-emerald-300">
            Link enviado!
          </p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Verifique o e-mail <strong>{email}</strong> e clique no link para
            entrar. (Confira também a caixa de spam.)
          </p>
        </div>
      ) : (
        // Formulário de login
        <form
          onSubmit={entrar}
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Seu e-mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {erro && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {carregando ? "Enviando…" : "Receber link de acesso"}
          </button>
        </form>
      )}
    </main>
  );
}
