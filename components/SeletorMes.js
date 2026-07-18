"use client";

import { useState } from "react";
import { rotuloMes } from "@/lib/formato";

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Seletor de mês/ano no estilo do app (arredondado, tema claro/escuro).
// Substitui o seletor nativo do navegador (que não dá para estilizar).
export default function SeletorMes({ mes, onEscolher }) {
  const [aberto, setAberto] = useState(false);
  const [anoVisto, setAnoVisto] = useState(Number(mes.split("-")[0]));

  const [anoAtual, mesAtual] = mes.split("-").map(Number);

  function abrir() {
    setAnoVisto(Number(mes.split("-")[0])); // sempre começa no ano atual
    setAberto((v) => !v);
  }

  function escolher(indice) {
    const mm = String(indice + 1).padStart(2, "0");
    onEscolher(`${anoVisto}-${mm}`);
    setAberto(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1 rounded-lg px-3 py-1 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        <span>{rotuloMes(mes)}</span>
        <span className="text-xs text-zinc-400">▾</span>
      </button>

      {aberto && (
        <>
          {/* Camada invisível: clicar fora fecha o seletor */}
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />

          <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {/* Navegação de ano */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnoVisto((a) => a - 1)}
                className="rounded-lg px-2.5 py-1 text-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Ano anterior"
              >
                ‹
              </button>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{anoVisto}</span>
              <button
                type="button"
                onClick={() => setAnoVisto((a) => a + 1)}
                className="rounded-lg px-2.5 py-1 text-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Próximo ano"
              >
                ›
              </button>
            </div>

            {/* Grade de meses */}
            <div className="grid grid-cols-3 gap-1.5">
              {MESES_CURTOS.map((m, i) => {
                const selecionado = anoVisto === anoAtual && i + 1 === mesAtual;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => escolher(i)}
                    className={`rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                      selecionado
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
