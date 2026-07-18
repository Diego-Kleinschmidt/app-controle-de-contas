"use client";

import { useState, useRef, useEffect } from "react";
import { criarVarios } from "@/lib/lancamentos";
import {
  formatarReais,
  hojeISO,
  paraNumero,
  formatarComoMoeda,
  ajustarAnoPorReferencia,
} from "@/lib/formato";

const campo =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// Diminui a imagem (mais leve e rápida para a IA) e devolve base64 + tipo.
function prepararImagem(arquivo, maxLado = 2000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maior = Math.max(width, height);
      if (maior > maxLado) {
        const escala = maxLado / maior;
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Lê um arquivo binário (PDF) como base64 puro (sem o prefixo "data:...").
function lerComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(arquivo);
  });
}

// Lê um arquivo de texto (CSV/OFX/TXT) como string.
function lerComoTexto(arquivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsText(arquivo);
  });
}

// Descobre o tipo do arquivo escolhido: imagem, pdf ou texto (csv/ofx/txt).
function tipoDoArquivo(arquivo) {
  const nome = (arquivo.name || "").toLowerCase();
  const mime = arquivo.type || "";
  if (mime.startsWith("image/")) return "imagem";
  if (mime === "application/pdf" || nome.endsWith(".pdf")) return "pdf";
  return "texto"; // csv, ofx, txt (costumam vir sem mime confiável)
}

// Monta o corpo (body) que será enviado para a API, conforme o tipo do arquivo.
async function prepararEnvio(arquivo) {
  const tipo = tipoDoArquivo(arquivo);
  if (tipo === "imagem") {
    const { base64, mimeType } = await prepararImagem(arquivo);
    return { base64, mimeType };
  }
  if (tipo === "pdf") {
    const base64 = await lerComoBase64(arquivo);
    return { base64, mimeType: "application/pdf" };
  }
  const texto = await lerComoTexto(arquivo);
  return { texto };
}

// Converte um número para o texto da máscara: 71.9 -> "71,90"
function valorMascara(n) {
  return formatarComoMoeda(String(Math.round(Number(n) * 100)));
}

// "Impressão digital" de um lançamento, para reconhecer repetidos:
// mesma data + mesmo valor + mesma descrição.
function chaveDedup(descricao, valor, data) {
  const desc = String(descricao).trim().toLowerCase();
  return `${String(data).slice(0, 10)}|${Number(valor).toFixed(2)}|${desc}`;
}

export default function ImportarExtrato({
  mesReferencia,
  existentes,
  perfis = [],
  usuarioId,
  onSalvo,
  onCancelar,
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [itens, setItens] = useState(null); // null = ainda não leu
  const [salvando, setSalvando] = useState(false);

  // Permite CANCELAR o pedido à IA se a tela for fechada no meio da leitura.
  const controladorRef = useRef(null);
  useEffect(() => {
    // Ao desmontar (fechar a janela), aborta qualquer leitura em andamento.
    return () => controladorRef.current?.abort();
  }, []);

  async function aoEscolherArquivo(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    // Novo controlador para esta leitura (permite cancelar ao fechar a tela)
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

      const respPadrao = usuarioId ?? perfis[0]?.id ?? "";
      const lidos = (dados.lancamentos || []).map((l) => {
        const ehReceita = l.tipo === "receita";
        return {
          descricao: l.descricao || "",
          valor: Math.abs(Number(l.valor)) || 0,
          // Extrato costuma vir sem ano — corrigimos pelo mês que está sendo visto
          data: ajustarAnoPorReferencia((l.data || hojeISO()).slice(0, 10), mesReferencia),
          responsavel_id: respPadrao,
          tipo: ehReceita ? "receita" : "despesa",
          // reembolso só faz sentido para despesa (estorno de cartão)
          reembolso: !ehReceita && Boolean(l.reembolso),
          // A IA sugere desmarcar itens que podem contar em dobro (pagamento de
          // fatura, saldo anterior, transferência sua...) e explica em "observacao".
          desmarcar: Boolean(l.desmarcar),
          observacao: String(l.observacao || ""),
          parcela_atual: Number(l.parcela_atual) || null,
          parcela_total: Number(l.parcela_total) || null,
        };
      });

      // Marca os que já existem no mês (mesma data + valor + descrição).
      // Usa contagem, para o caso de haver itens realmente iguais repetidos.
      const contagem = {};
      for (const e of existentes || []) {
        const k = chaveDedup(e.descricao, e.valor, e.data);
        contagem[k] = (contagem[k] || 0) + 1;
      }
      const comDedup = lidos.map((it) => {
        const assinado = it.reembolso ? -it.valor : it.valor;
        const k = chaveDedup(it.descricao, assinado, it.data);
        let jaExiste = false;
        if (contagem[k] > 0) {
          jaExiste = true;
          contagem[k] -= 1;
        }
        // Vem desmarcado se já existe, ou se a IA sugeriu desmarcar
        return { ...it, jaExiste, incluir: !jaExiste && !it.desmarcar };
      });

      if (comDedup.length === 0) {
        setErro("Não identifiquei lançamentos nesse arquivo. Tente um print mais nítido ou outro arquivo.");
      } else {
        setItens(comDedup);
      }
    } catch (e) {
      // Se foi cancelado (tela fechada), não é erro — apenas ignoramos.
      if (e.name !== "AbortError") setErro(e.message);
    } finally {
      controladorRef.current = null;
      setCarregando(false);
    }
  }

  function atualizar(i, campo, valor) {
    setItens((atual) =>
      atual.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it))
    );
  }

  // Valor do seletor Gasto / Entrada / Reembolso a partir do item
  function classificacaoDe(it) {
    if (it.tipo === "receita") return "entrada";
    return it.reembolso ? "reembolso" : "gasto";
  }

  // Troca a classificação, ajustando "tipo" e "reembolso" de uma vez
  function mudarClassificacao(i, valor) {
    setItens((atual) =>
      atual.map((it, idx) => {
        if (idx !== i) return it;
        if (valor === "entrada") return { ...it, tipo: "receita", reembolso: false };
        if (valor === "reembolso") return { ...it, tipo: "despesa", reembolso: true };
        return { ...it, tipo: "despesa", reembolso: false }; // gasto
      })
    );
  }

  async function salvar() {
    const escolhidos = itens
      .filter((it) => it.incluir && it.valor > 0 && it.descricao.trim())
      .map((it) => {
        const ehReceita = it.tipo === "receita";
        return {
          descricao: it.descricao.trim(),
          tipo: ehReceita ? "receita" : "despesa",
          // Reembolso entra como valor NEGATIVO (abate das contas do mês)
          valor: it.reembolso ? -it.valor : it.valor,
          data: it.data,
          responsavel_id: it.responsavel_id || null,
          // Parcelamento só para gasto comum (nem receita, nem reembolso)
          parcela_atual: ehReceita || it.reembolso ? null : it.parcela_atual,
          parcela_total: ehReceita || it.reembolso ? null : it.parcela_total,
        };
      });

    if (escolhidos.length === 0) {
      setErro("Marque ao menos um item para salvar.");
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

  // Totais separados: gastos (reembolsos abatem) e entradas (receitas)
  const selecionados = itens ? itens.filter((it) => it.incluir) : [];
  const totalGastos = selecionados
    .filter((it) => it.tipo !== "receita")
    .reduce((s, it) => s + (it.reembolso ? -it.valor : it.valor), 0);
  const totalEntradas = selecionados
    .filter((it) => it.tipo === "receita")
    .reduce((s, it) => s + it.valor, 0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          📷 Importar extrato
        </h2>
        {onCancelar && (
          <button
            onClick={onCancelar}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            Fechar
          </button>
        )}
      </div>

      {/* Passo 1: enviar o arquivo (some depois que a IA lê) */}
      {!itens && (
        <>
          {carregando ? (
            // Estado de leitura em DESTAQUE (a IA pode levar alguns segundos)
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50 py-12 text-center dark:border-sky-700 dark:bg-sky-950/40">
              <span className="text-5xl motion-safe:animate-bounce">🤖</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl font-bold text-sky-700 dark:text-sky-300">
                  Lendo o arquivo…
                </span>
                <span className="text-sm text-sky-600 dark:text-sky-400">
                  A IA está analisando. Aguarde uns segundos.
                </span>
              </div>
              <span className="h-9 w-9 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500 dark:border-sky-900 dark:border-t-sky-400" />
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                A IA lê seus gastos automaticamente. Você só confere e salva.
              </p>
              <label className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-9 text-center transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-sky-600 dark:hover:bg-sky-950/20">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl shadow-sm transition-transform group-hover:scale-110 dark:bg-sky-900/50">
                  📤
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                    Toque para escolher um arquivo
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    print, PDF ou arquivo do banco
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {["🖼️ Imagem", "📄 PDF", "🏦 OFX", "📊 CSV"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf,.pdf,.ofx,.csv,text/csv,text/plain"
                  onChange={aoEscolherArquivo}
                  className="hidden"
                />
              </label>
            </>
          )}
        </>
      )}

      {/* Passo 2: revisão dos itens lidos */}
      {itens && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A IA leu <strong>{itens.length}</strong> item(ns).{" "}
            {itens.some((it) => it.jaExiste) && (
              <>
                <strong>{itens.filter((it) => it.jaExiste).length}</strong> já
                estava(m) lançado(s) e foi(ram) pré-desmarcado(s).{" "}
              </>
            )}
            Confira, marque de quem é e o tipo (gasto, entrada ou reembolso) e ajuste o que quiser.
          </p>

          <div className="flex flex-col gap-3">
            {itens.map((it, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  it.incluir
                    ? "border-zinc-200 dark:border-zinc-800"
                    : "border-zinc-200 opacity-50 dark:border-zinc-800"
                }`}
              >
                <div className="mb-2 flex flex-wrap gap-1">
                  {it.jaExiste && (
                    <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      já lançado neste mês
                    </span>
                  )}
                  {it.desmarcar && !it.jaExiste && (
                    <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      desmarcado{it.observacao ? `: ${it.observacao}` : " (confira antes de incluir)"}
                    </span>
                  )}
                  {!it.reembolso && it.parcela_total > 1 && (
                    <span className="inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      parcela {it.parcela_atual}/{it.parcela_total} — as próximas vão para os meses seguintes
                    </span>
                  )}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={it.incluir}
                    onChange={(e) => atualizar(i, "incluir", e.target.checked)}
                    className="h-4 w-4"
                  />
                  <input
                    type="text"
                    value={it.descricao}
                    onChange={(e) => atualizar(i, "descricao", e.target.value)}
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
                      atualizar(i, "valor", paraNumero(formatarComoMoeda(e.target.value)))
                    }
                    className={campo}
                    placeholder="0,00"
                  />
                  <input
                    type="date"
                    value={it.data}
                    onChange={(e) => atualizar(i, "data", e.target.value)}
                    className={campo}
                  />
                  <select
                    value={it.responsavel_id}
                    onChange={(e) => atualizar(i, "responsavel_id", e.target.value)}
                    className={campo}
                  >
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={classificacaoDe(it)}
                    onChange={(e) => mudarClassificacao(i, e.target.value)}
                    className={campo}
                  >
                    <option value="gasto">Gasto (saída)</option>
                    <option value="entrada">Entrada (receita)</option>
                    <option value="reembolso">Reembolso</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Gastos selecionados</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {formatarReais(totalGastos)}
              </span>
            </div>
            {totalEntradas > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Entradas selecionadas</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatarReais(totalEntradas)}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

      {itens && (
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {salvando ? "Salvando…" : "Confirmar e salvar"}
        </button>
      )}
    </div>
  );
}
