// Funções ajudantes para formatar valores e trabalhar com meses.

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Transforma um número em texto de dinheiro: 1800 -> "R$ 1.800,00"
export function formatarReais(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

// Converte texto digitado no formato brasileiro em número.
// "71,00" -> 71   |   "7.100,50" -> 7100.5   |   "71" -> 71
export function paraNumero(texto) {
  if (texto === null || texto === undefined) return NaN;
  let s = String(texto).trim();
  // Se tem vírgula, o ponto é separador de milhar e a vírgula é o decimal
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  return Number(s);
}

// Formata enquanto digita, estilo "caixa eletrônico":
// os dígitos entram pela direita como centavos.
// "7" -> "0,07"  |  "7100" -> "71,00"  |  "710000" -> "7.100,00"
export function formatarComoMoeda(texto) {
  const digitos = String(texto).replace(/\D/g, "");
  if (!digitos) return "";
  const reais = parseInt(digitos, 10) / 100;
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "2026-07" -> "Julho / 2026"
export function rotuloMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} / ${ano}`;
}

// Mês atual no formato "AAAA-MM"
export function mesCorrente() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-06-10" -> "10/06/2026" (sem depender de fuso horário)
export function formatarDataBR(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Monta uma data válida "AAAA-MM-DD" dentro de um mês, respeitando o
// último dia do mês (ex.: dia 31 em fevereiro vira o dia 28/29).
export function dataDoMes(mesRef, dia) {
  const [ano, mes] = mesRef.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const d = Math.min(dia, ultimoDia);
  return `${mesRef}-${String(d).padStart(2, "0")}`;
}

// Data de hoje no formato "AAAA-MM-DD" (para o campo de data)
export function hojeISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Corrige o ANO de uma data ISO (AAAA-MM-DD) SÓ quando ele parece errado.
// Extratos de cartão costumam vir SEM ano, e a IA chuta um ano distante (ex.: 2024).
// Já arquivos do banco (CSV/OFX) trazem o ano CERTO — nesse caso não mexemos.
// Regra: se o ano vindo do documento estiver perto (até 1 ano) do mês em foco,
// confiamos nele. Se estiver bem longe, escolhemos o ano cujo mês fica mais
// próximo do mês de referência.
// Ex.: vendo "2026-08", "2024-07-15" (longe) vira "2026-07-15"; "2026-07-10" (perto) fica igual.
export function ajustarAnoPorReferencia(dataISO, mesReferencia) {
  if (!dataISO || !mesReferencia) return dataISO;
  const [anoStr, mesStr, diaStr] = String(dataISO).slice(0, 10).split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  if (!ano || !mes || !dia) return dataISO;

  const [refAno, refMes] = mesReferencia.split("-").map(Number);

  // Ano do documento é plausível → confia nele (não atropela CSV/OFX do banco).
  if (Math.abs(ano - refAno) <= 1) return dataISO;

  // Ano claramente errado/ausente → escolhe o ano mais próximo do mês em foco.
  let melhorAno = refAno;
  let melhorDist = Infinity;
  for (const a of [refAno - 1, refAno, refAno + 1]) {
    const dist = Math.abs(a * 12 + mes - (refAno * 12 + refMes));
    if (dist < melhorDist) {
      melhorDist = dist;
      melhorAno = a;
    }
  }
  const mm = String(mes).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${melhorAno}-${mm}-${dd}`;
}

// Soma "n" meses a um mês "AAAA-MM" (n pode ser negativo)
export function somarMeses(mes, n) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}
