"use client";

// Tela que recebe o conteúdo "compartilhado" pelo celular. Quando chega uma
// notificação/SMS do banco, a pessoa toca em "Compartilhar", escolhe este app,
// e o Android abre esta página com o texto nos parâmetros da URL. A gente passa
// esse texto para a IA ler e já sugerir o lançamento (reaproveita a tela de importar).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { listarPerfis, listarPorMes } from "@/lib/lancamentos";
import { mesCorrente, somarMeses } from "@/lib/formato";
import ImportarExtrato from "@/components/ImportarExtrato";

function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();
  // O sistema pode mandar título, texto e/ou link — juntamos tudo.
  const texto = ["title", "text", "url"]
    .map((k) => params.get(k))
    .filter(Boolean)
    .join("\n")
    .trim();

  // undefined = ainda verificando sessão; null = não logado; objeto = logado
  const [usuario, setUsuario] = useState(undefined);
  const [perfis, setPerfis] = useState([]);
  const [existentes, setExistentes] = useState([]);
  // Mesmo mês padrão do painel (próximo mês), para cair onde a pessoa costuma ver.
  const mes = somarMeses(mesCorrente(), 1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null);
    });
  }, []);

  // Com usuário logado, carrega perfis e o que já existe no mês (p/ marcar repetidos)
  useEffect(() => {
    if (!usuario) return;
    listarPerfis().then(setPerfis).catch(() => {});
    listarPorMes(mes).then(setExistentes).catch(() => {});
  }, [usuario, mes]);

  if (usuario === undefined) {
    return <Aviso texto="Abrindo…" />;
  }

  if (!usuario) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">
          Para lançar o que você compartilhou, entre primeiro.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Entrar
        </Link>
      </div>
    );
  }

  if (!texto) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">
          Nada veio no compartilhamento. Volte e tente de novo.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Ir para as contas
        </Link>
      </div>
    );
  }

  const meu = perfis.find((p) => p.id === usuario.id);
  const ehAdmin = Boolean(meu?.admin);

  return (
    <ImportarExtrato
      mesReferencia={mes}
      existentes={existentes}
      perfis={perfis}
      usuarioId={usuario.id}
      responsavelPadrao={usuario.id}
      travarResponsavel={!ehAdmin}
      textoInicial={texto}
      onSalvo={() => router.replace("/")}
      onCancelar={() => router.replace("/")}
    />
  );
}

function Aviso({ texto }) {
  return (
    <p className="text-center text-zinc-500 dark:text-zinc-400">{texto}</p>
  );
}

export default function CompartilharPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-4 py-6">
      <Suspense fallback={<Aviso texto="Abrindo…" />}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
