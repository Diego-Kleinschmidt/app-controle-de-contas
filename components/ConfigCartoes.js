"use client";

import { useState } from "react";
import { criarCartao, apagarCartao } from "@/lib/lancamentos";

// Tela (dentro de um modal) onde o admin cadastra e remove os cartões/meios
// de pagamento da família (Nubank, Itaú, Pix, Dinheiro...). Depois é só escolher
// o cartão em cada lançamento e dá para agrupar as contas por cartão.
export default function ConfigCartoes({ cartoes = [], onFechar, onMudou }) {
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [apagandoId, setApagandoId] = useState(null);
  const [erro, setErro] = useState(null);

  async function adicionar(evento) {
    evento.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    // Evita cadastrar dois cartões com o mesmo nome
    if (cartoes.some((c) => c.nome.trim().toLowerCase() === nome.toLowerCase())) {
      setErro("Já existe um cartão com esse nome.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await criarCartao(nome);
      setNovo("");
      onMudou?.();
    } catch (e) {
      setErro(e.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(c) {
    setErro(null);
    setApagandoId(c.id);
    try {
      await apagarCartao(c.id);
      onMudou?.();
    } catch (e) {
      setErro(e.message ?? "Não foi possível apagar.");
    } finally {
      setApagandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          💳 Meus cartões
        </h2>
        <button
          onClick={onFechar}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          Fechar
        </button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cadastre seus cartões/meios (ex.: Nubank, Itaú, Pix, Dinheiro). Depois é só
        marcar em cada lançamento — e dá para agrupar as contas por cartão.
      </p>

      {/* Adicionar novo cartão */}
      <form onSubmit={adicionar} className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Nome do cartão (ex.: Nubank)"
          className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={salvando || !novo.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {salvando ? "…" : "Adicionar"}
        </button>
      </form>

      {/* Lista de cartões cadastrados */}
      {cartoes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nenhum cartão cadastrado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cartoes.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                💳 {c.nome}
              </span>
              <button
                onClick={() => remover(c)}
                disabled={apagandoId === c.id}
                className="text-zinc-400 transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
                aria-label={`Apagar ${c.nome}`}
                title="Apagar cartão"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Apagar um cartão não apaga as contas — elas apenas ficam “sem cartão”.
      </p>

      {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}
    </div>
  );
}
