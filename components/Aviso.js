"use client";

import { useEffect, useState } from "react";

// Aviso que aparece ao abrir o app. Fica guardado no navegador que a pessoa já
// leu (por "id"), então não volta a aparecer. Para mostrar um aviso NOVO no
// futuro, é só trocar o "id" e o "texto" em AVISO_ATUAL (no PainelContas).
export default function Aviso({ id, titulo, texto }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      const jaViu = localStorage.getItem(`aviso-visto-${id}`);
      setVisivel(!jaViu);
    } catch {
      setVisivel(true);
    }
  }, [id]);

  function fechar() {
    setVisivel(false);
    try {
      localStorage.setItem(`aviso-visto-${id}`, "1");
    } catch {
      /* ignora se o navegador bloquear o armazenamento */
    }
  }

  if (!visivel) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
      <span className="text-2xl leading-none">📣</span>
      <div className="flex-1 min-w-0">
        {titulo && (
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">{titulo}</p>
        )}
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{texto}</p>
      </div>
      <button
        onClick={fechar}
        className="shrink-0 rounded-lg px-2 py-0.5 text-emerald-600 transition-colors hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
        aria-label="Fechar aviso"
        title="Fechar aviso"
      >
        ✕
      </button>
    </div>
  );
}
