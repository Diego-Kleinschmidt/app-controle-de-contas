import { supabase } from "@/lib/supabaseClient";
import { somarMeses, dataDoMes } from "@/lib/formato";

// Quantos meses à frente uma conta "recorrente" é criada de uma vez.
const MESES_RECORRENTE = 12;

// Busca os perfis (usuários) — usado para escolher/exibir o responsável.
export async function listarPerfis() {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, admin")
    .order("nome");
  if (error) throw error;
  return data;
}

// Busca os lançamentos de um mês (ex.: "2026-07"), do mais antigo ao mais novo.
export async function listarPorMes(mes) {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("mes_referencia", mes)
    .order("data", { ascending: true });

  if (error) throw error;
  return data;
}

// Salva vários gastos de uma vez (usado na importação do extrato por IA).
// Todos entram como despesa única, no mês informado.
export async function criarVarios(itens, mesReferencia) {
  const linhas = itens.map((it) => ({
    tipo: "despesa",
    descricao: it.descricao,
    valor: it.valor,
    data: it.data,
    mes_referencia: mesReferencia,
    responsavel_id: it.responsavel_id || null,
    forma: "unica",
    parcela_atual: null,
    parcela_total: null,
  }));

  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) throw error;
}

// Atualiza os campos básicos de um lançamento (não mexe em parcelamento).
export async function atualizar(id, dados) {
  const { error } = await supabase
    .from("lancamentos")
    .update({
      // NÃO mexemos em mes_referencia aqui: assim o lançamento continua no
      // mês em que está, sem "pular" para outro mês ao editar.
      tipo: dados.tipo,
      descricao: dados.descricao,
      valor: dados.valor,
      data: dados.data,
      responsavel_id: dados.responsavel_id || null,
    })
    .eq("id", id);
  if (error) throw error;
}

// Fixa/desafixa um lançamento (para ele ficar no topo da lista).
export async function fixar(id, fixado) {
  const { error } = await supabase
    .from("lancamentos")
    .update({ fixado })
    .eq("id", id);
  if (error) throw error;
}

// Apaga um lançamento pelo id.
export async function apagar(id) {
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}

// Cria um lançamento.
// Se for "parcelada" (ex.: 10x), gera automaticamente uma linha por mês,
// numerando as parcelas (1 de 10, 2 de 10, ...). Assim a compra "some"
// sozinha quando a última parcela é paga.
export async function criar(dados) {
  // Mês de destino = mês que está sendo visto (ou, na falta, o mês da data)
  const mesBase = dados.mesReferencia || dados.data.slice(0, 7);
  const dia = Number(dados.data.slice(8, 10)); // dia escolhido
  const total = Number(dados.parcela_total);

  // Campos comuns a todas as linhas
  const base = {
    tipo: dados.tipo,
    descricao: dados.descricao,
    valor: dados.valor,
    responsavel_id: dados.responsavel_id || null,
  };

  const linhas = [];

  if (dados.forma === "parcelada" && total > 1) {
    // Uma parcela por mês (1/N, 2/N, ...), cada uma com a data no seu mês
    for (let i = 0; i < total; i++) {
      const mesRef = somarMeses(mesBase, i);
      linhas.push({
        ...base,
        data: dataDoMes(mesRef, dia),
        mes_referencia: mesRef,
        forma: "parcelada",
        parcela_atual: i + 1,
        parcela_total: total,
      });
    }
  } else if (dados.forma === "recorrente") {
    // Repete pelos próximos meses, com a data ajustada a cada mês
    for (let i = 0; i < MESES_RECORRENTE; i++) {
      const mesRef = somarMeses(mesBase, i);
      linhas.push({
        ...base,
        data: dataDoMes(mesRef, dia),
        mes_referencia: mesRef,
        forma: "recorrente",
        parcela_atual: null,
        parcela_total: null,
      });
    }
  } else {
    // Lançamento único
    linhas.push({
      ...base,
      data: dados.data,
      mes_referencia: mesBase,
      forma: "unica",
      parcela_atual: null,
      parcela_total: null,
    });
  }

  const { error } = await supabase.from("lancamentos").insert(linhas);
  if (error) throw error;
}
