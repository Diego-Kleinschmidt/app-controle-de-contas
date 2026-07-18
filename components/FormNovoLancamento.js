"use client";

import { useState } from "react";
import { criar, atualizar } from "@/lib/lancamentos";
import { hojeISO, paraNumero, formatarComoMoeda } from "@/lib/formato";

// Estilo reaproveitado nos campos
const campo =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

// Converte o valor guardado (número) para o texto do campo: 71 -> "71,00"
function valorInicial(lancamento) {
  if (!lancamento) return "";
  return formatarComoMoeda(String(Math.round(Number(lancamento.valor) * 100)));
}

export default function FormNovoLancamento({
  lancamento,
  mesReferencia,
  perfis = [],
  usuarioId,
  travarResponsavel = false, // não-admin: fixa o responsável nele mesmo
  onSalvo,
  onCancelar,
}) {
  const edicao = Boolean(lancamento); // estamos editando algo existente?

  const [tipo, setTipo] = useState(lancamento?.tipo ?? "despesa");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(valorInicial(lancamento));
  const [data, setData] = useState((lancamento?.data ?? "").slice(0, 10) || hojeISO());
  const [responsavelId, setResponsavelId] = useState(
    lancamento?.responsavel_id ?? usuarioId ?? perfis[0]?.id ?? ""
  );
  const [forma, setForma] = useState("unica");
  const [parcelaTotal, setParcelaTotal] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault();
    setErro(null);

    if (!descricao.trim()) return setErro("Escreva uma descrição.");
    if (!(paraNumero(valor) > 0)) return setErro("Informe um valor maior que zero.");
    if (!edicao && forma === "parcelada" && !(Number(parcelaTotal) > 1)) {
      return setErro("Para compra parcelada, informe o número de parcelas (2 ou mais).");
    }

    setSalvando(true);
    try {
      const dados = {
        tipo,
        descricao: descricao.trim(),
        valor: paraNumero(valor),
        data,
        responsavel_id: responsavelId || null,
        forma,
        parcela_total: parcelaTotal,
        mesReferencia, // mês que está sendo visto = mês da conta
      };

      if (edicao) {
        await atualizar(lancamento.id, dados);
      } else {
        await criar(dados);
        // Limpa o formulário para um novo lançamento
        setDescricao("");
        setValor("");
        setForma("unica");
        setParcelaTotal("");
      }
      onSalvo?.(); // avisa a tela principal para recarregar a lista
    } catch (e) {
      setErro(e.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {edicao ? "Editar lançamento" : "Novo lançamento"}
      </h2>

      {/* Tipo: receita ou despesa */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTipo("receita")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            tipo === "receita"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          Entrada (receita)
        </button>
        <button
          type="button"
          onClick={() => setTipo("despesa")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            tipo === "despesa"
              ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          Saída (despesa)
        </button>
      </div>

      {/* Descrição */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Descrição</span>
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Conta de luz"
          className={campo}
        />
      </label>

      {/* Valor e data lado a lado */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Valor (R$)</span>
          <input
            type="text"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(formatarComoMoeda(e.target.value))}
            placeholder="0,00"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className={campo}
          />
        </label>
      </div>

      {/* Responsável: vale para despesa e receita.
          Não-admin (travarResponsavel) só lança para si — sem escolher. */}
      {!travarResponsavel && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">De quem é?</span>
          <select
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            className={campo}
          >
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Forma e parcelas: só ao criar (na edição não mexemos no parcelamento) */}
      {!edicao && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de lançamento
            </span>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className={campo}
            >
              <option value="unica">Única (acontece uma vez)</option>
              <option value="recorrente">Recorrente (repete todo mês, ex.: luz)</option>
              <option value="parcelada">Parcelada (ex.: cartão em 10x)</option>
            </select>
          </label>

          {forma === "parcelada" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Em quantas parcelas?
              </span>
              <input
                type="number"
                min="2"
                value={parcelaTotal}
                onChange={(e) => setParcelaTotal(e.target.value)}
                placeholder="Ex.: 10"
                className={campo}
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Vamos criar uma parcela por mês automaticamente.
              </span>
            </label>
          )}
        </>
      )}

      {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {salvando ? "Salvando…" : edicao ? "Salvar alterações" : "Adicionar lançamento"}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
