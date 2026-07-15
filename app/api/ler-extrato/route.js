// Função que roda NO SERVIDOR (não no navegador).
// Ela recebe a imagem do extrato, chama a IA do Google (Gemini) e devolve
// a lista de gastos. A chave da IA fica escondida aqui, longe do navegador.

export const runtime = "nodejs";

// Modelo de IA usado (gratuito). Se um dia sair de linha, é só trocar aqui.
const MODELO = "gemini-flash-latest";

const INSTRUCAO = `Você recebe a imagem de um extrato ou fatura de cartão de crédito.
Extraia TODAS as movimentações: tanto COMPRAS/GASTOS quanto REEMBOLSOS/ESTORNOS
(créditos, devoluções, valores que voltam para a pessoa).

Responda SOMENTE com um JSON válido neste formato exato:
{"lancamentos":[{"data":"AAAA-MM-DD","descricao":"texto curto","valor":123.45,"reembolso":false}]}

Regras:
- "valor" é sempre um número POSITIVO em reais (ex.: 71.90), sem "R$" e sem sinal.
- "reembolso": true quando for estorno/reembolso/crédito/devolução; false para compras.
- "data" no formato AAAA-MM-DD. Se o ano não aparecer, use o ano atual.
- IGNORE apenas: totais, saldos, limites, juros e PAGAMENTOS de fatura.
- Não invente nada. Se não conseguir ler, devolva {"lancamentos":[]}.`;

export async function POST(request) {
  try {
    const { imagemBase64, mimeType } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { erro: "A chave da IA (GEMINI_API_KEY) não está configurada." },
        { status: 500 }
      );
    }
    if (!imagemBase64) {
      return Response.json({ erro: "Nenhuma imagem foi enviada." }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

    const corpo = {
      contents: [
        {
          parts: [
            { text: INSTRUCAO },
            { inline_data: { mime_type: mimeType || "image/png", data: imagemBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro do Gemini:", resposta.status, detalhe);

      let mensagem = "A IA retornou um erro. Tente de novo.";
      if (resposta.status === 429) {
        mensagem =
          "Limite de uso gratuito da IA atingido. Espere cerca de 1 minuto e tente de novo.";
      } else if (resposta.status === 503 || resposta.status === 500) {
        mensagem = "A IA está sobrecarregada agora. Tente de novo em instantes.";
      }
      return Response.json({ erro: mensagem }, { status: 502 });
    }

    const dados = await resposta.json();
    const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let resultado;
    try {
      resultado = JSON.parse(texto);
    } catch {
      resultado = { lancamentos: [] };
    }

    return Response.json({ lancamentos: resultado.lancamentos ?? [] });
  } catch (e) {
    return Response.json(
      { erro: e.message ?? "Falha ao processar a imagem." },
      { status: 500 }
    );
  }
}
