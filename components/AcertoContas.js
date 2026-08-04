"use client";

import { formatarReais } from "@/lib/formato";

// Tela (admin) que mostra, por pessoa, quanto ela deve transferir no mês:
//   Total das contas dela − o que "fica na conta" (não transferir) = a transferir.
// Não conta os lançamentos "a receber" (terceiro), que são de outra natureza.
export default function AcertoContas({ lista = [], perfis = [], meuId, mesLabel, onFechar }) {
  // Só as outras pessoas (quem te transfere); você (admin) não transfere pra si.
  const pessoas = perfis.filter((p) => p.id !== meuId);

  function contasDe(pid) {
    return lista.filter(
      (l) => l.responsavel_id === pid && l.tipo === "despesa" && !l.terceiro
    );
  }
  const soma = (itens) => itens.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          🧮 Acerto de contas
        </h2>
        <button
          onClick={onFechar}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          Fechar
        </button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Quanto cada pessoa te transfere em <strong>{mesLabel}</strong>. Itens marcados
        como <em>“não transferir”</em> (ex.: empréstimo, cotas) ficam na conta dela.
      </p>

      {pessoas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nenhuma outra pessoa na família ainda.
        </p>
      ) : (
        pessoas.map((p) => {
          const contas = contasDe(p.id);
          // "total" = contas que somam no saldo dela (líquido, = o hero).
          // "fica" = o que fica na conta dela (empréstimo/cotas) e é descontado.
          const total = soma(contas.filter((l) => !l.nao_transferir));
          const fica = soma(contas.filter((l) => l.nao_transferir));
          const aTransferir = total - fica;
          if (contas.length === 0) return null;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.nome}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Total das contas</span>
                <span className="text-zinc-700 dark:text-zinc-300">{formatarReais(total)}</span>
              </div>
              {fica !== 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Fica na conta</span>
                  <span className="text-zinc-500 dark:text-zinc-400">− {formatarReais(fica)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">A transferir</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarReais(aTransferir)}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
