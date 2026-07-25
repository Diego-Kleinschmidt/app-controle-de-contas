import { supabase } from "@/lib/supabaseClient";
import { somarMeses, dataDoMes } from "@/lib/formato";

// Quantos meses à frente uma conta "recorrente" é criada de uma vez.
const MESES_RECORRENTE = 12;

// Busca o grupo (família) do usuário logado — inclui o código de convite.
export async function obterGrupo() {
  const { data, error } = await supabase
    .from("grupos")
    .select("id, nome, codigo_convite")
    .maybeSingle();
  if (error) {
    // Pode acontecer se a migração multi-familias.sql ainda não foi rodada
    // (tabela "grupos" inexistente) ou se o usuário ainda não tem grupo.
    // Seguimos sem o código de convite, sem travar a tela.
    console.warn("obterGrupo (grupo indisponível):", error.message || error);
    return null;
  }
  return data;
}

// Busca os perfis (usuários) — usado para escolher/exibir o responsável.
export async function listarPerfis() {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, admin, pode_lancar")
    .order("nome");
  if (error) throw error;
  return data;
}

// Liga/desliga a permissão de "pode lançar" de uma pessoa (só admin consegue).
export async function definirPodeLancar(id, podeLancar) {
  const { error } = await supabase
    .from("perfis")
    .update({ pode_lancar: podeLancar })
    .eq("id", id);
  if (error) throw error;
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
// - Gasto comum → uma linha no mês informado.
// - Gasto PARCELADO (ex.: parcela 3 de 10) → cria também as parcelas seguintes
//   (4/10, 5/10, ... 10/10) nos próximos meses, para já aparecerem lá na frente.
export async function criarVarios(itens, mesReferencia) {
  const linhas = [];

  for (const it of itens) {
    const tipo = it.tipo === "receita" ? "receita" : "despesa";
    const total = Number(it.parcela_total) || 0;
    const atual = Number(it.parcela_atual) || 0;

    // Parcelamento só vale para despesa (compra parcelada no cartão)
    if (tipo === "despesa" && total > 1 && atual >= 1 && atual <= total) {
      const dia = Number(String(it.data).slice(8, 10)) || 1;
      // Da parcela atual (neste mês) até a última, um mês por parcela
      for (let i = 0; atual + i <= total; i++) {
        const mesRef = somarMeses(mesReferencia, i);
        linhas.push({
          tipo: "despesa",
          descricao: it.descricao,
          valor: it.valor,
          data: dataDoMes(mesRef, dia),
          mes_referencia: mesRef,
          responsavel_id: it.responsavel_id || null,
          forma: "parcelada",
          parcela_atual: atual + i,
          parcela_total: total,
        });
      }
    } else {
      linhas.push({
        tipo,
        descricao: it.descricao,
        valor: it.valor,
        data: it.data,
        mes_referencia: mesReferencia,
        responsavel_id: it.responsavel_id || null,
        forma: "unica",
        parcela_atual: null,
        parcela_total: null,
      });
    }
  }

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
      terceiro: dados.terceiro || null,
    })
    .eq("id", id);
  if (error) throw error;
}

// Atualiza a série DESTE MÊS EM DIANTE (recorrente/parcelada): aplica os novos
// valores às linhas com a MESMA descrição ORIGINAL, responsável e forma, cujo
// mês seja >= o mês do lançamento editado. O PASSADO fica como está.
// NÃO mexe na data (cada mês mantém a sua). Comparação de "AAAA-MM" funciona
// como texto porque o mês vem sempre com zero à esquerda.
export async function atualizarSerie(original, dados) {
  const q = filtrarSerie(
    supabase.from("lancamentos").update({
      tipo: dados.tipo,
      descricao: dados.descricao,
      valor: dados.valor,
      responsavel_id: dados.responsavel_id || null,
    }),
    original
  );
  const { error } = await q;
  if (error) throw error;
}

// Marca/desmarca uma conta "a receber" como já recebida (a pessoa te pagou).
export async function marcarRecebido(id, recebido) {
  const { error } = await supabase
    .from("lancamentos")
    .update({ recebido })
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

// Restringe uma query à SÉRIE de um lançamento, DESTE MÊS EM DIANTE.
// Usa o serie_id (único) quando existe; senão, cai no jeito antigo (nome+forma+
// responsável) para lançamentos criados antes desta coluna existir.
function filtrarSerie(q, l) {
  q = q.gte("mes_referencia", l.mes_referencia);
  if (l.serie_id) return q.eq("serie_id", l.serie_id);
  q = q.eq("descricao", l.descricao).eq("forma", l.forma);
  return l.responsavel_id
    ? q.eq("responsavel_id", l.responsavel_id)
    : q.is("responsavel_id", null);
}

// Apaga a série DESTE MÊS EM DIANTE (recorrente/parcelada). O passado fica.
// O RLS garante que só apaga o que a pessoa pode.
export async function apagarSerie(l) {
  const q = filtrarSerie(supabase.from("lancamentos").delete(), l);
  const { error } = await q;
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

  // Séries (parcelada/recorrente) ganham um id único, para não se confundirem
  // com outra série igual (mesmo nome/valor). Lançamento único não tem série.
  const ehSerie = dados.forma === "parcelada" || dados.forma === "recorrente";
  const serieId = ehSerie ? crypto.randomUUID() : null;

  // Campos comuns a todas as linhas
  const base = {
    tipo: dados.tipo,
    descricao: dados.descricao,
    valor: dados.valor,
    responsavel_id: dados.responsavel_id || null,
    terceiro: dados.terceiro || null, // conta "a receber" (paguei por outra pessoa)
    fixado: Boolean(dados.fixado), // fixa no topo (em todos os meses, se for série)
    serie_id: serieId,
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
