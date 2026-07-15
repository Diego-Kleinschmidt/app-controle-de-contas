"use client";

import { useCallback, useEffect, useState } from "react";
import { listarPorMes, apagar, fixar } from "@/lib/lancamentos";
import { formatarReais, rotuloMes, mesCorrente, somarMeses, formatarDataBR } from "@/lib/formato";
import FormNovoLancamento from "@/components/FormNovoLancamento";
import ImportarExtrato from "@/components/ImportarExtrato";

export default function PainelContas({ usuario, onSair }) {
  // "pessoa" vem da conta do usuário. Se for "mae", vê só as contas dela;
  // qualquer outro valor (ou vazio) é tratado como administrador (Diego).
  const pessoa = usuario?.user_metadata?.pessoa ?? "diego";
  const ehAdmin = pessoa !== "mae";

  // Começa no PRÓXIMO mês: as contas lançadas agora costumam ser pagas no mês seguinte.
  const [mes, setMes] = useState(somarMeses(mesCorrente(), 1));
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarImport, setMostrarImport] = useState(false);
  const [editando, setEditando] = useState(null);
  // Admin começa em "todos"; a mãe fica travada em "mae".
  const [filtro, setFiltro] = useState(ehAdmin ? "todos" : "mae");

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

  async function alternarFixado(l) {
    await fixar(l.id, !l.fixado);
    carregar();
  }

  // Cálculos do mês
  const gastosMae = lista
    .filter((l) => l.tipo === "despesa" && l.responsavel === "mae")
    .reduce((s, l) => s + Number(l.valor), 0);

  // Lista conforme o filtro escolhido (todos / minhas / da mãe)
  const listaFiltrada = lista.filter((l) => {
    if (filtro === "diego") return l.responsavel === "diego";
    if (filtro === "mae") return l.responsavel === "mae";
    return true;
  });
  // Somatórios conforme o filtro escolhido
  const despesasVisiveis = listaFiltrada
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + Number(l.valor), 0);
  const receitasVisiveis = listaFiltrada
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saldoVisivel = receitasVisiveis - despesasVisiveis;

  const rotuloHero =
    filtro === "diego"
      ? "Minhas contas (Diego)"
      : filtro === "mae"
      ? "Contas da mãe"
      : "Contas do mês (até agora)";

  // Fixados sempre no topo (mantendo a ordem por data dentro de cada grupo)
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    if (Boolean(a.fixado) !== Boolean(b.fixado)) return a.fixado ? -1 : 1;
    return 0;
  });

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

      {/* Filtro: Todos / Minhas / Da Mãe (só para administrador) */}
      {ehAdmin && (
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            { chave: "todos", rotulo: "Todos" },
            { chave: "diego", rotulo: "Minhas" },
            { chave: "mae", rotulo: "Da Mãe" },
          ].map((op) => (
            <button
              key={op.chave}
              onClick={() => setFiltro(op.chave)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === op.chave
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {op.rotulo}
            </button>
          ))}
        </div>
      )}

      {/* Cartão do total de contas (número principal) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Herói: total das contas conforme o filtro */}
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {rotuloHero}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
          {formatarReais(despesasVisiveis)}
        </p>

        {/* Somatórios do filtro atual */}
        <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Entradas</dt>
            <dd className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatarReais(receitasVisiveis)}
            </dd>
          </div>
          {receitasVisiveis > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500 dark:text-zinc-400">Sobra (entradas − contas)</dt>
              <dd
                className={`font-semibold ${
                  saldoVisivel >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatarReais(saldoVisivel)} {saldoVisivel >= 0 ? "✅" : "⚠️"}
              </dd>
            </div>
          )}
          {filtro === "todos" && gastosMae > 0 && (
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

      {/* Botões e formulários de NOVO / IMPORTAR (só admin, e não ao editar) */}
      {ehAdmin && !editando && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMostrarForm((v) => !v);
                setMostrarImport(false);
              }}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {mostrarForm ? "Fechar" : "+ Novo lançamento"}
            </button>
            <button
              onClick={() => {
                setMostrarImport((v) => !v);
                setMostrarForm(false);
              }}
              className="rounded-lg border border-zinc-900 px-4 py-2.5 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {mostrarImport ? "Fechar" : "📷 Importar extrato"}
            </button>
          </div>

          {mostrarForm && (
            <FormNovoLancamento
              mesReferencia={mes}
              onSalvo={() => {
                setMostrarForm(false);
                carregar();
              }}
            />
          )}

          {mostrarImport && (
            <ImportarExtrato
              mesReferencia={mes}
              existentes={lista}
              onSalvo={() => {
                setMostrarImport(false);
                carregar();
              }}
              onCancelar={() => setMostrarImport(false)}
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
        ) : listaFiltrada.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nenhum lançamento nesta visão. 👆
          </p>
        ) : (
          listaOrdenada.map((l) => (
            <div
              key={l.id}
              className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 ${
                l.fixado
                  ? "border-amber-300 dark:border-amber-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {l.descricao}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatarDataBR(l.data)}</span>
                  {l.responsavel && (
                    <span>• {l.responsavel === "mae" ? "Mãe" : "Diego"}</span>
                  )}
                  {l.forma === "parcelada" && (
                    <span>
                      • parcela {l.parcela_atual}/{l.parcela_total}
                    </span>
                  )}
                  {l.forma === "recorrente" && <span>• recorrente</span>}
                  {l.tipo === "despesa" && Number(l.valor) < 0 && (
                    <span>• reembolso</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-3">
                <span
                  className={`font-semibold ${
                    l.tipo === "receita" || Number(l.valor) < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {l.tipo === "receita" || Number(l.valor) < 0 ? "+" : "−"}{" "}
                  {formatarReais(Math.abs(Number(l.valor)))}
                </span>
                {ehAdmin && (
                  <>
                    <button
                      onClick={() => alternarFixado(l)}
                      className={`transition-colors ${
                        l.fixado
                          ? "opacity-100"
                          : "opacity-30 grayscale hover:opacity-100 hover:grayscale-0"
                      }`}
                      aria-label={l.fixado ? "Desafixar" : "Fixar no topo"}
                      title={l.fixado ? "Desafixar" : "Fixar no topo"}
                    >
                      📌
                    </button>
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
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
