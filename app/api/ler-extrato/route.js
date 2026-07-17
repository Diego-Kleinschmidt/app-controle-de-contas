// Função que roda NO SERVIDOR (não no navegador).
// Ela recebe a imagem do extrato, chama a IA do Google (Gemini) e devolve
// a lista de gastos. A chave da IA fica escondida aqui, longe do navegador.

export const runtime = "nodejs";
// A leitura da imagem pela IA pode demorar. Damos até 60s (o padrão da
// Vercel é ~10s, o que interrompia a análise no meio).
export const maxDuration = 60;

// Modelos de IA (gratuitos), em ordem de preferência. Cada modelo tem sua
// PRÓPRIA cota no plano gratuito, então, se o primeiro estourar o limite (429),
// tentamos o próximo automaticamente. (Testado na conta: ambos funcionam.)
const MODELOS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

const INSTRUCAO = `Você recebe a imagem de um extrato ou fatura de cartão de crédito.
Extraia TODAS as movimentações: tanto COMPRAS/GASTOS quanto REEMBOLSOS/ESTORNOS
(créditos, devoluções, valores que voltam para a pessoa).

Responda SOMENTE com um JSON válido neste formato exato:
{"lancamentos":[{"data":"AAAA-MM-DD","descricao":"texto curto","valor":123.45,"reembolso":false,"parcela_atual":null,"parcela_total":null}]}

Regras:
- "valor" é sempre um número POSITIVO em reais (ex.: 71.90), sem "R$" e sem sinal.
- "reembolso": true quando for estorno/reembolso/crédito/devolução; false para compras.
- "data" no formato AAAA-MM-DD. Se o ano não aparecer, use o ano atual.
- PARCELAMENTO: se a linha indicar parcela (ex.: "PARC 03/10", "3/10", "Parcela 3 de 10",
  "03 DE 10"), preencha "parcela_atual" (número desta parcela, ex.: 3) e "parcela_total"
  (total de parcelas, ex.: 10). O "valor" é o de UMA parcela (o valor que aparece na linha),
  não o total da compra. Se NÃO for parcelado, use "parcela_atual":null e "parcela_total":null.
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

    // Quando a IA está sobrecarregada (503/500), tentamos de novo algumas vezes
    // sozinhos, com uma pausa crescente entre as tentativas. Assim o usuário não
    // precisa reenviar o print na mão.
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const TENTATIVAS = 4;
    const PAUSAS = [1500, 3000, 5000]; // pausa antes de cada nova tentativa

    let resposta;
    // Tenta cada modelo em ordem. Se um estourar o limite (429) ou ficar
    // sobrecarregado, passa automaticamente para o próximo (cota separada).
    for (const modelo of MODELOS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

      for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
        resposta = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });

        // Deu certo, ou é um erro que não adianta repetir → sai do laço interno
        const valeRepetir = resposta.status === 503 || resposta.status === 500;
        if (resposta.ok || !valeRepetir || tentativa === TENTATIVAS) break;

        console.warn(
          `Gemini "${modelo}" sobrecarregado (${resposta.status}). Tentativa ${tentativa}/${TENTATIVAS}, aguardando…`
        );
        await espera(PAUSAS[tentativa - 1] ?? 5000);
      }

      if (resposta.ok) break; // funcionou com este modelo
      console.warn(
        `Modelo "${modelo}" indisponível (${resposta.status}). Tentando o próximo…`
      );
    }

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro do Gemini:", resposta.status, detalhe);

      let mensagem = "A IA retornou um erro. Tente de novo.";
      if (resposta.status === 429) {
        // O Google separa o limite "por dia" do "por minuto". Se o detalhe
        // menciona o limite diário, avisamos que só reseta no dia seguinte.
        const limiteDiario = /per\s*day|perday/i.test(detalhe);
        mensagem = limiteDiario
          ? "Você atingiu o limite gratuito da IA de HOJE. Ele reseta amanhã. (Dá para lançar manualmente enquanto isso.)"
          : "Muitas leituras em pouco tempo (limite por minuto do plano gratuito). Espere cerca de 1 minuto e tente de novo.";
      } else if (resposta.status === 503 || resposta.status === 500) {
        mensagem =
          "A IA está muito sobrecarregada agora (já tentei algumas vezes). Espere um pouquinho e tente de novo.";
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
