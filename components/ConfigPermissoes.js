"use client";

import { useState } from "react";
import { definirPodeLancar } from "@/lib/lancamentos";

// Tela (dentro de um modal) onde o admin liga/desliga quem pode lançar.
// Cada pessoa liberada pode adicionar/editar/apagar apenas as PRÓPRIAS contas.
export default function ConfigPermissoes({ perfis = [], meuId, onFechar, onMudou }) {
  const [salvandoId, setSalvandoId] = useState(null);
  const [erro, setErro] = useState(null);

  async function alternar(perfil) {
    setErro(null);
    setSalvandoId(perfil.id);
    try {
      await definirPodeLancar(perfil.id, !perfil.pode_lancar);
      onMudou?.(); // recarrega a lista de perfis na tela principal
    } catch (e) {
      setErro(e.message ?? "Não foi possível salvar.");
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          ⚙️ Quem pode lançar
        </h2>
        <button
          onClick={onFechar}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          Fechar
        </button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Quem estiver ligado pode adicionar, editar e apagar as <strong>próprias</strong> contas.
        Você (admin) continua vendo e mexendo em tudo.
      </p>

      <div className="flex flex-col gap-2">
        {perfis.map((p) => {
          const ehAdmin = Boolean(p.admin);
          const ligado = ehAdmin || Boolean(p.pode_lancar);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {p.nome}
                  {p.id === meuId && (
                    <span className="ml-1 text-xs text-zinc-400">(você)</span>
                  )}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {ehAdmin ? "Administrador — pode tudo" : ligado ? "Pode lançar" : "Só visualiza"}
                </p>
              </div>

              {/* Interruptor. Admin fica sempre ligado e travado. */}
              <button
                onClick={() => !ehAdmin && alternar(p)}
                disabled={ehAdmin || salvandoId === p.id}
                aria-label={ligado ? "Desligar" : "Ligar"}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  ligado ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                } ${ehAdmin ? "opacity-60" : ""} ${salvandoId === p.id ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    ligado ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}
    </div>
  );
}
