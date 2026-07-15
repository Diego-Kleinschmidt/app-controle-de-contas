"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PainelContas from "@/components/PainelContas";

export default function Home() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    // Pega a sessão atual (também processa o retorno do link de e-mail)
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null);
      setCarregando(false);
    });

    // Fica ouvindo login/logout enquanto a tela está aberta
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUsuario(sessao?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Se terminou de carregar e não tem ninguém logado, vai para o login
  useEffect(() => {
    if (!carregando && !usuario) {
      router.replace("/login");
    }
  }, [carregando, usuario, router]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 dark:text-zinc-400">Carregando…</p>
      </main>
    );
  }

  if (!usuario) return null; // está sendo redirecionado para o login

  return <PainelContas usuario={usuario} onSair={sair} />;
}
