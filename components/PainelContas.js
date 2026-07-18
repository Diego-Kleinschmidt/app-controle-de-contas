"use client";

import { useCallback, useEffect, useState } from "react";
import { listarPorMes, apagar, fixar, listarPerfis, obterGrupo } from "@/lib/lancamentos";
import { formatarReais, mesCorrente, somarMeses, formatarDataBR } from "@/lib/formato";
import FormNovoLancamento from "@/components/FormNovoLancamento";
import ImportarExtrato from "@/components/ImportarExtrato";
import SeletorMes from "@/components/SeletorMes";
import BotaoTema from "@/components/BotaoTema";
import ConfigPermissoes from "@/components/ConfigPermissoes";
import ConfirmarModal from "@/components/ConfirmarModal";
import Modal from "@/components/Modal";

export default function PainelContas({ usuario, onSair }) {
  const [mes, setMes] = useState(somarMeses(mesCorrente(), 1));
  const [lista, setLista] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [grupo, setGrupo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarImport, setMostrarImport] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState(""); // id do usuário em foco (sempre alguém)
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [aExcluir, setAExcluir] = useState(null); // lançamento aguardando confirmação
  const [excluindo, setExcluindo] = useState(false);

  // Quem sou eu? Se meu perfil for admin, vejo tudo e posso administrar.
  const meuPerfil = perfis.find((p) => p.id === usuario.id);
  const ehAdmin = Boolean(meuPerfil?.admin);
  // Pode lançar = admin ou pessoa liberada pelo admin (mexe só nas próprias).
  const podeLancar = ehAdmin || Boolean(meuPerfil?.pode_lancar);
  const nomePorId = Object.fromEntries(perfis.map((p) => [p.id, p.nome]));

  // Recarrega a lista de perfis (usado após mudar permissões)
  const carregarPerfis = useCallback(() => {
    listarPerfis()
      .then(setPerfis)
      .catch((e) => console.error(e));
  }, []);

  // Carrega os perfis e o grupo uma vez
  useEffect(() => {
    carregarPerfis();
    obterGrupo()
      .then(setGrupo)
      .catch((e) => console.error(e));
  }, [carregarPerfis]);

  // Define a pessoa inicial assim que os perfis chegam: a própria pessoa
  // logada (se estiver na lista) ou a primeira. Sempre há alguém em foco.
  useEffect(() => {
    if (!filtro && perfis.length > 0) {
      const meu = perfis.find((p) => p.id === usuario.id);
      setFiltro(meu ? meu.id : perfis[0].id);
    }
  }, [perfis, filtro, usuario.id]);

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

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await apagar(aExcluir.id);
      setAExcluir(null);
      carregar();
    } catch (e) {
      console.error(e);
    } finally {
      setExcluindo(false);
    }
  }

  async function alternarFixado(l) {
    await fixar(l.id, !l.fixado);
    carregar();
  }

  // Lista conforme o filtro (todos ou um usuário específico)
  const listaFiltrada = lista.filter((l) => {
    if (!filtro || filtro === "todos") return true; // "" = antes dos perfis carregarem
    return l.responsavel_id === filtro;
  });

  // Somatórios do que está visível
  const despesasVisiveis = listaFiltrada
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + Number(l.valor), 0);
  const receitasVisiveis = listaFiltrada
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saldoVisivel = receitasVisiveis - despesasVisiveis;

  const rotuloHero =
    !filtro || filtro === "todos"
      ? "Contas do mês (até agora)"
      : `Contas de ${nomePorId[filtro] ?? "usuário"}`;

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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {meuPerfil?.nome || usuario.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ehAdmin && (
            <button
              onClick={() => setMostrarConfig(true)}
              className="rounded-lg p-1.5 text-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Quem pode lançar"
              title="Quem pode lançar"
            >
              ⚙️
            </button>
          )}
          <BotaoTema />
          <button
            onClick={onSair}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            Sair
          </button>
        </div>
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
        {/* Toque no nome do mês para escolher mês/ano num seletor no tema do app */}
        <SeletorMes mes={mes} onEscolher={setMes} />
        <button
          onClick={() => setMes(somarMeses(mes, 1))}
          className="rounded-lg px-3 py-1 text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      {/* Filtro por usuário (só para administrador).
          Sempre há uma pessoa em foco (não existe "todos"): clicar troca a pessoa. */}
      {ehAdmin && perfis.length > 0 && (
        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {perfis.map((op) => (
            <button
              key={op.id}
              onClick={() => setFiltro(op.id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === op.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {op.nome}
            </button>
          ))}
        </div>
      )}

      {/* Cartão do total de contas (número principal) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {rotuloHero}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
          {formatarReais(despesasVisiveis)}
        </p>

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
        </dl>
      </section>

      {/* Botões de NOVO / IMPORTAR (abrem em modal) — para quem pode lançar */}
      {podeLancar && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMostrarForm(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Novo lançamento
          </button>
          <button
            onClick={() => setMostrarImport(true)}
            className="rounded-lg border border-zinc-900 px-4 py-2.5 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            📷 Importar extrato
          </button>
        </div>
      )}

      {/* Modal: confirmar exclusão */}
      {aExcluir && (
        <ConfirmarModal
          titulo="Apagar lançamento?"
          mensagem={`"${aExcluir.descricao}" — ${formatarReais(
            Math.abs(Number(aExcluir.valor))
          )}. Essa ação não pode ser desfeita.`}
          carregando={excluindo}
          onConfirmar={confirmarExclusao}
          onCancelar={() => setAExcluir(null)}
        />
      )}

      {/* Modal: configuração de permissões (só admin) */}
      {ehAdmin && mostrarConfig && (
        <Modal onClose={() => setMostrarConfig(false)}>
          <ConfigPermissoes
            perfis={perfis}
            meuId={usuario.id}
            onMudou={carregarPerfis}
            onFechar={() => setMostrarConfig(false)}
          />
        </Modal>
      )}

      {/* Modal: novo lançamento */}
      {podeLancar && mostrarForm && (
        <Modal onClose={() => setMostrarForm(false)}>
          <FormNovoLancamento
            mesReferencia={mes}
            perfis={perfis}
            usuarioId={usuario.id}
            travarResponsavel={!ehAdmin}
            onSalvo={() => {
              setMostrarForm(false);
              carregar();
            }}
            onCancelar={() => setMostrarForm(false)}
          />
        </Modal>
      )}

      {/* Modal: editar lançamento */}
      {editando && (
        <Modal onClose={() => setEditando(null)}>
          <FormNovoLancamento
            key={editando.id}
            lancamento={editando}
            perfis={perfis}
            usuarioId={usuario.id}
            travarResponsavel={!ehAdmin}
            onSalvo={() => {
              setEditando(null);
              carregar();
            }}
            onCancelar={() => setEditando(null)}
          />
        </Modal>
      )}

      {/* Modal: importar extrato */}
      {podeLancar && mostrarImport && (
        <Modal onClose={() => setMostrarImport(false)}>
          <ImportarExtrato
            mesReferencia={mes}
            existentes={lista}
            perfis={perfis}
            usuarioId={usuario.id}
            travarResponsavel={!ehAdmin}
            onSalvo={() => {
              setMostrarImport(false);
              carregar();
            }}
            onCancelar={() => setMostrarImport(false)}
          />
        </Modal>
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
                  {l.responsavel_id && nomePorId[l.responsavel_id] && (
                    <span>• {nomePorId[l.responsavel_id]}</span>
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
                {/* Fixar: admin ou dono da conta. Editar/apagar: admin ou quem
                    CRIOU o lançamento (não basta estar no nome da pessoa). */}
                {(() => {
                  const ehMinha = l.responsavel_id === usuario.id;
                  const euCriei = l.criado_por === usuario.id;
                  const podeFixar = ehAdmin || ehMinha;
                  const podeMexer = ehAdmin || (podeLancar && euCriei);
                  return (
                    <>
                      {podeFixar && (
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
                      )}
                      {podeMexer && (
                        <>
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
                            onClick={() => setAExcluir(l)}
                            className="text-zinc-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                            aria-label="Apagar"
                            title="Apagar"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Código de convite (só admin) — para adicionar alguém à família */}
      {ehAdmin && grupo?.codigo_convite && (
        <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Código de convite da família:{" "}
          <span className="font-mono font-semibold text-zinc-600 dark:text-zinc-300">
            {grupo.codigo_convite}
          </span>
          <br />
          Compartilhe para alguém entrar na sua família no cadastro.
        </p>
      )}
    </main>
  );
}
