// Helpers compartilhados para LER um extrato/fatura com a IA:
//  - prepararEnvio(arquivo): transforma o arquivo escolhido (imagem/PDF/CSV/OFX)
//    no corpo que a API /api/ler-extrato espera.
//  - nomesParecidos(a, b): diz se dois nomes parecem o mesmo lançamento.
// Usado tanto na Importação quanto na Conferência por cartão.

import { semAcento } from "@/lib/formato";

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
export async function prepararEnvio(arquivo) {
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

// Dois nomes "parecem" o mesmo lançamento? Compara sem acento/maiúsculas e
// ignorando pontuação (ex.: "Uber" x "*UBE HELPING"). Considera parecido quando
// um contém o outro, ou quando compartilham um "pedaço" de 3+ letras (prefixo).
export function nomesParecidos(a, b) {
  const limpa = (t) =>
    semAcento(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const na = limpa(a);
  const nb = limpa(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const toks = (s) => s.split(" ").filter((t) => t.length >= 3);
  for (const x of toks(na)) {
    for (const y of toks(nb)) {
      const curto = x.length <= y.length ? x : y;
      const longo = x.length <= y.length ? y : x;
      if (longo.startsWith(curto)) return true; // "ube" casa com "uber"
    }
  }
  return false;
}
