"use client";

import { useState, useRef, useEffect } from "react";
import { criarVarios } from "@/lib/lancamentos";
import { prepararEnvio, nomesParecidos } from "@/lib/leituraExtrato";
import {
  formatarReais,
  hojeISO,
  paraNumero,
  formatarComoMoeda,
  ajustarAnoPorReferencia,
} from "@/lib/formato";

const campo =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function valorMascara(n) {
  return formatarComoMoeda(String(Math.round(Number(n) * 100)));
}

// Conferência/auditoria de um cartão (só admin): você escolhe o cartão, manda o
// print do extrato/fatura e o app compara com o que JÁ está lançado NESSE cartão
// (seu e da sua mãe — todos). Mostra o que já está conferido e o que falta lançar.
export default function ConferenciaCartao({
  mesReferencia,
  lista = [], // lançamentos do mês (todas as pessoas — admin vê tudo)
  perfis = [],
  cartoes = [],
  usuarioId,
  mesLabel,
  onSalvo,
  onFechar,
}) {
  const [cartaoId, setCartaoId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null); // {conferidos, faltando, sobrando}
  const [salvando, setSalvando] = useState(false);

  const controladorRef = useRef(null);
  useEffect(() => () => controladorRef.current?.abort(), []);

  // Já lançados NESTE cartão no mês (de qualquer pessoa — seu e da sua mãe).
  const lancadosDoCartao = lista.filter(
    (l) => l.cartao_id === cartaoId && !l.terceiro
  );

  async function aoEscolherArquivo(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    if (!cartaoId) {
      setErro("Escolha o cartão primeiro.");
      return;
    }
    setErro(null);
    setCarregando(true);
    const controlador = new AbortController();
    controladorRef.current = controlador;
    try {
      const envio = await prepararEnvio(arquivo);
      const resposta = await fetch("/api/ler-extrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envio),
        signal: controlador.signal,
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível ler o extrato.");
      montarConferencia(dados.lancamentos || []);
    } catch (e) {
      if (e.name !== "AbortError") setErro(e.message);
    } finally {
      controladorRef.current = null;
      setCarregando(false);
    }
  }

  // Compara os itens lidos com os já lançados no cartão: casa por VALOR + nome
  // parecido (cada lançado casa com um item lido só uma vez).
  function montarConferencia(lancamentos) {
    const respPadrao = usuarioId || perfis[0]?.id || "";
    const lidos = (lancamentos || [])
      .map((l) => {
        const ehReceita = l.tipo === "receita";
        return {
          descricao: l.descricao || "",
          valor: Math.abs(Number(l.valor)) || 0,
          data: ajustarAnoPorReferencia((l.data || hojeISO()).slice(0, 10), mesReferencia),
          tipo: ehReceita ? "receita" : "despesa",
          reembolso: !ehReceita && Boolean(l.reembolso),
          parcela_atual: Number(l.parcela_atual) || null,
          parcela_total: Number(l.parcela_total) || null,
        };
      })
      .filter((it) => it.valor > 0 && it.descricao.trim());

    const disp = lancadosDoCartao.map((e) => ({
      ref: e,
      valor: Math.abs(Number(e.valor)).toFixed(2),
      desc: e.descricao || "",
      usado: false,
    }));

    const conferidos = [];
    const faltando = [];
    for (const it of lidos) {
      const val = Math.abs(Number(it.valor)).toFixed(2);
      const achado = disp.find(
        (e) => !e.usado && e.valor === val && nomesParecidos(e.desc, it.descricao)
      );
      if (achado) {
        achado.usado = true;
        conferidos.push(it);
      } else {
        faltando.push({ ...it, incluir: true, responsavel_id: respPadrao });
      }
    }
    // Lançados no cartão que NÃO apareceram no print (pode ser erro/duplicado)
    const sobrando = disp.filter((e) => !e.usado).map((e) => e.ref);

    setResultado({ conferidos, faltando, sobrando });
  }

  function atualizarFaltando(i, chave, valor) {
    setResultado((r) => ({
      ...r,
      faltando: r.faltando.map((it, idx) => (idx === i ? { ...it, [chave]: valor } : it)),
    }));
  }

  async function salvar() {
    const escolhidos = resultado.faltando
      .filter((it) => it.incluir && it.valor > 0 && it.descricao.trim())
      .map((it) => {
        const ehReceita = it.tipo === "receita";
        return {
          descricao: it.descricao.trim(),
          tipo: ehReceita ? "receita" : "despesa",
          valor: it.reembolso ? -it.valor : it.valor,
          data: it.data,
          responsavel_id: it.responsavel_id || null,
          cartao_id: cartaoId || null,
          parcela_atual: ehReceita || it.reembolso ? null : it.parcela_atual,
          parcela_total: ehReceita || it.reembolso ? null : it.parcela_total,
        };
      });

    if (escolhidos.length === 0) {
      // Nada marcado para lançar — apenas fecha (conferência feita).
      onSalvo?.();
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarVarios(escolhidos, mesReferencia);
      onSalvo?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const nomeCartao = cartoes.find((c) => c.id === cartaoId)?.nome || "";
  const marcadosFaltando = resultado
    ? resultado.faltando.filter((it) => it.incluir).length
    : 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          🔎 Conferir cartão
        </h2>
        <button
          onClick={onFechar}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          Fechar
        </button>
      </div>

      {/* Passo 1: escolher cartão + mandar o print (some após conferir) */}
      {!resultado && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Escolha o cartão e mande o print do extrato/fatura de{" "}
            <strong>{mesLabel}</strong>. Vou comparar com o que já está lançado nesse
            cartão (seu e da sua mãe) e mostrar o que falta.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cartão a conferir
            </span>
            <select
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value)}
              className={campo}
            >
              <option value="">Escolha um cartão…</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          {cartoes.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 py-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Cadastre um cartão primeiro (botão 💳 no topo).
            </p>
          )}

          {carregando ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50 py-12 text-center dark:border-sky-700 dark:bg-sky-950/40">
              <span className="text-5xl motion-safe:animate-bounce">🤖</span>
              <span className="text-xl font-bold text-sky-700 dark:text-sky-300">
                Conferindo…
              </span>
              <span className="h-9 w-9 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500 dark:border-sky-900 dark:border-t-sky-400" />
            </div>
          ) : (
            cartaoId && (
              <>
                <label className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-9 text-center transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-sky-600 dark:hover:bg-sky-950/20">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl shadow-sm transition-transform group-hover:scale-110 dark:bg-sky-900/50">
                    📷
                  </span>
                  <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                    Toque para tirar/escolher uma foto
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={aoEscolherArquivo}
                    className="hidden"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-1.5 text-center text-sm text-zinc-500 underline-offset-2 hover:text-sky-600 hover:underline dark:text-zinc-400 dark:hover:text-sky-400">
                  <span>ou enviar um arquivo (PDF, OFX ou CSV)</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.ofx,.csv,text/csv,text/plain"
                    onChange={aoEscolherArquivo}
                    className="hidden"
                  />
                </label>
              </>
            )
          )}
        </>
      )}

      {/* Passo 2: resultado da conferência */}
      {resultado && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              💳 {nomeCartao}
            </span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✅ {resultado.conferidos.length} já lançado(s)
            </span>
            <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              ❌ {resultado.faltando.length} faltando
            </span>
          </div>

          {/* Faltando lançar: você decide o que entra */}
          {resultado.faltando.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Faltando lançar — marque o que quer adicionar:
              </p>
              {resultado.faltando.map((it, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 ${
                    it.incluir
                      ? "border-amber-300 dark:border-amber-800"
                      : "border-zinc-200 opacity-50 dark:border-zinc-800"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.incluir}
                      onChange={(e) => atualizarFaltando(i, "incluir", e.target.checked)}
                      className="h-4 w-4"
                    />
                    <input
                      type="text"
                      value={it.descricao}
                      onChange={(e) => atualizarFaltando(i, "descricao", e.target.value)}
                      className={`${campo} flex-1`}
                      placeholder="Descrição"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={valorMascara(it.valor)}
                      onChange={(e) =>
                        atualizarFaltando(i, "valor", paraNumero(formatarComoMoeda(e.target.value)))
                      }
                      className={campo}
                      placeholder="0,00"
                    />
                    <input
                      type="date"
                      value={it.data}
                      onChange={(e) => atualizarFaltando(i, "data", e.target.value)}
                      className={campo}
                    />
                    <select
                      value={it.responsavel_id}
                      onChange={(e) => atualizarFaltando(i, "responsavel_id", e.target.value)}
                      className={`${campo} col-span-2`}
                    >
                      {perfis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  {it.parcela_total > 1 && (
                    <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                      parcela {it.parcela_atual}/{it.parcela_total} — as próximas vão para os
                      meses seguintes
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 py-4 text-center text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
              🎉 Tudo deste print já está lançado nesse cartão!
            </p>
          )}

          {/* Já conferidos (só leitura) */}
          {resultado.conferidos.length > 0 && (
            <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                ✅ Já lançados ({resultado.conferidos.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {resultado.conferidos.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="truncate">{it.descricao}</span>
                    <span className="shrink-0 pl-2">{formatarReais(it.valor)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Lançado no cartão mas não veio no print (confira se não é erro) */}
          {resultado.sobrando.length > 0 && (
            <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-400">
                ⚠️ Lançado no app, mas não apareceu no print ({resultado.sobrando.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {resultado.sobrando.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="truncate">{l.descricao}</span>
                    <span className="shrink-0 pl-2">
                      {formatarReais(Math.abs(Number(l.valor)))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                Pode ser um lançamento a mais, ou algo que não estava visível no print.
              </p>
            </details>
          )}
        </>
      )}

      {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

      {resultado && (
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {salvando
            ? "Salvando…"
            : marcadosFaltando > 0
            ? `Lançar ${marcadosFaltando} selecionado(s)`
            : "Concluir conferência"}
        </button>
      )}
    </div>
  );
}
