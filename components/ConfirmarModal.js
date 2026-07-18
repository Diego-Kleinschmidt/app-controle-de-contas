"use client";

import Modal from "@/components/Modal";

// Janela de confirmação bonita (substitui o confirm() feio do navegador).
export default function ConfirmarModal({
  titulo,
  mensagem,
  textoConfirmar = "Apagar",
  carregando = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal>
      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl dark:bg-rose-950/50">
            🗑️
          </span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{titulo}</h2>
          {mensagem && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{mensagem}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancelar}
            disabled={carregando}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={carregando}
            className="rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {carregando ? "Apagando…" : textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
