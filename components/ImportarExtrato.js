"use client";

import { useState } from "react";
import { criarVarios } from "@/lib/lancamentos";
import { formatarReais, hojeISO, paraNumero, formatarComoMoeda } from "@/lib/formato";

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

  async function aoEscolherArquivo(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const { base64, mimeType } = await prepararImagem(arquivo);
      const resposta = await fetch("/api/ler-extrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagemBase64: base64, mimeType }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível ler o extrato.");

      const respPadrao = usuarioId ?? perfis[0]?.id ?? "";
      const lidos = (dados.lancamentos || []).map((l) => ({
        descricao: l.descricao || "",
        valor: Math.abs(Number(l.valor)) || 0,
        data: (l.data || hojeISO()).slice(0, 10),
        responsavel_id: respPadrao,
        reembolso: Boolean(l.reembolso),
      }));

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
        return { ...it, jaExiste, incluir: !jaExiste };
      });

      if (comDedup.length === 0) {
        setErro("Não identifiquei gastos nessa imagem. Tente um print mais nítido.");
      } else {
        setItens(comDedup);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  function atualizar(i, campo, valor) {
    setItens((atual) =>
      atual.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it))
    );
  }

  async function salvar() {
    const escolhidos = itens
      .filter((it) => it.incluir && it.valor > 0 && it.descricao.trim())
      .map((it) => ({
        descricao: it.descricao.trim(),
        // Reembolso entra como valor NEGATIVO (abate das contas do mês)
        valor: it.reembolso ? -it.valor : it.valor,
        data: it.data,
        responsavel_id: it.responsavel_id || null,
      }));

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

  // Total: gastos somam, reembolsos abatem
  const total = itens
    ? itens
        .filter((it) => it.incluir)
        .reduce((s, it) => s + (it.reembolso ? -it.valor : it.valor), 0)
    : 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          📷 Importar do extrato
        </h2>
        {onCancelar && (
          <button
            onClick={onCancelar}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Fechar
          </button>
        )}
      </div>

      {/* Passo 1: enviar a imagem (some depois que a IA lê) */}
      {!itens && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Envie um print do extrato/fatura. A IA vai ler os gastos e você revisa
            antes de salvar.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-950">
            <span className="text-3xl">🖼️</span>
            <span>{carregando ? "Lendo a imagem…" : "Toque para escolher a imagem"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={aoEscolherArquivo}
              disabled={carregando}
              className="hidden"
            />
          </label>
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
            Confira, marque de quem é (gasto ou reembolso) e ajuste o que quiser.
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
                {it.jaExiste && (
                  <span className="mb-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    já lançado neste mês
                  </span>
                )}
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
                    value={it.reembolso ? "reembolso" : "gasto"}
                    onChange={(e) => atualizar(i, "reembolso", e.target.value === "reembolso")}
                    className={campo}
                  >
                    <option value="gasto">Gasto</option>
                    <option value="reembolso">Reembolso</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Total selecionado</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {formatarReais(total)}
            </span>
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
