"use client";

import { useCallback, useEffect, useState } from "react";
import { listarPorMes, apagar } from "@/lib/lancamentos";
import { formatarReais, rotuloMes, mesCorrente, somarMeses, formatarDataBR } from "@/lib/formato";
import FormNovoLancamento from "@/components/FormNovoLancamento";

export default function PainelContas({ usuario, onSair }) {
  // Começa no PRÓXIMO mês: as contas lançadas agora costumam ser pagas no mês seguinte.
  const [mes, setMes] = useState(somarMeses(mesCorrente(), 1));
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);

  // Carrega os lançamentos do mês selecionado
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await listarPorMes(mes));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function removerLancamento(id) {
    if (!confirm("Apagar este lançamento?")) return;
    await apagar(id);
    carregar();
  }

  // Cálculos do mês
  const receitas = lista
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + Number(l.valor), 0);
  const despesas = lista
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saldo = receitas - despesas;
  const gastosMae = lista
    .filter((l) => l.tipo === "despesa" && l.responsavel === "mae")
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            💰 Controle de Contas
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{usuario.email}</p>
        </div>
        <button
          onClick={onSair}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sair
        </button>
      </header>

      {/* Navegação entre meses */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setMes(somarMeses(mes, -1))}
          className="rounded-lg px-3 py-1 text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {rotuloMes(mes)}
        </span>
        <button
          onClick={() => setMes(somarMeses(mes, 1))}
          className="rounded-lg px-3 py-1 text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      {/* Cartão do total de contas (número principal) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Herói: total das contas lançadas até agora */}
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Contas do mês (até agora)
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
          {formatarReais(despesas)}
        </p>

        {/* Extras: entradas e saldo */}
        <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Entradas (salário etc.)</dt>
            <dd className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatarReais(receitas)}
            </dd>
          </div>
          {receitas > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Sobra (entradas − contas)</dt>
              <dd
                className={`font-semibold ${
                  saldo >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatarReais(saldo)} {saldo >= 0 ? "✅" : "⚠️"}
              </dd>
            </div>
          )}
          {gastosMae > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Contas da mãe</dt>
              <dd className="font-medium text-zinc-700 dark:text-zinc-200">
                {formatarReais(gastosMae)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Formulário de EDIÇÃO (aparece quando uma conta está sendo editada) */}
      {editando && (
        <FormNovoLancamento
          key={editando.id}
          lancamento={editando}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {/* Botão e formulário de NOVO lançamento (escondidos enquanto edita) */}
      {!editando && (
        <>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {mostrarForm ? "Fechar" : "+ Novo lançamento"}
          </button>

          {mostrarForm && (
            <FormNovoLancamento
              mesReferencia={mes}
              onSalvo={() => {
                setMostrarForm(false);
                carregar();
              }}
            />
          )}
        </>
      )}

      {/* Lista de lançamentos do mês */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Lançamentos
        </h2>

        {carregando ? (
          <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Carregando…
          </p>
        ) : lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nenhum lançamento neste mês. Que tal adicionar o primeiro? 👆
          </p>
        ) : (
          lista.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {l.descricao}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatarDataBR(l.data)}</span>
                  {l.tipo === "despesa" && l.responsavel && (
                    <span>• {l.responsavel === "mae" ? "Mãe" : "Diego"}</span>
                  )}
                  {l.forma === "parcelada" && (
                    <span>
                      • parcela {l.parcela_atual}/{l.parcela_total}
                    </span>
                  )}
                  {l.forma === "recorrente" && <span>• recorrente</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-3">
                <span
                  className={`font-semibold ${
                    l.tipo === "receita"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {l.tipo === "receita" ? "+" : "−"} {formatarReais(l.valor)}
                </span>
                <button
                  onClick={() => {
                    setMostrarForm(false);
                    setEditando(l);
                  }}
                  className="text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Editar"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => removerLancamento(l.id)}
                  className="text-zinc-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                  aria-label="Apagar"
                  title="Apagar"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
