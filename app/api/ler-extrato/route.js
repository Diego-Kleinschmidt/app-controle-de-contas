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

const INSTRUCAO = `Você recebe um documento bancário — pode ser FATURA DE CARTÃO DE CRÉDITO
ou EXTRATO DE CONTA CORRENTE (conta bancária) — como imagem, PDF ou texto (CSV/OFX).
Extraia TODAS as movimentações de dinheiro: tanto SAÍDAS (gastos) quanto ENTRADAS.

Responda SOMENTE com um JSON válido neste formato exato:
{"lancamentos":[{"data":"AAAA-MM-DD","descricao":"texto curto","valor":123.45,"tipo":"despesa","reembolso":false,"desmarcar":false,"observacao":"","parcela_atual":null,"parcela_total":null}]}

Regras:
- "valor" é sempre um número POSITIVO em reais (ex.: 71.90), sem "R$" e sem sinal.
- "tipo": "despesa" quando o dinheiro SAI (compra, pagamento, boleto, débito, PIX enviado,
  prestação de empréstimo, tarifa, conta de água/luz/internet). "receita" quando o dinheiro
  ENTRA (crédito, PIX recebido, salário, transferência recebida, depósito).
- "reembolso": true SOMENTE para estorno/devolução/crédito que volta numa FATURA DE CARTÃO
  (nesse caso "tipo":"despesa" e "reembolso":true). Nos demais casos, false.
- "data" no formato AAAA-MM-DD. Se o ano não aparecer, use o ano atual.
- PARCELAMENTO: se a linha indicar parcela X de Y, preencha "parcela_atual" (X, sem zeros à
  esquerda) e "parcela_total" (Y). Vale tanto para CARTÃO (ex.: "PARC 03/10", "3/10",
  "Parcela 3 de 10") quanto para EMPRÉSTIMO/PRESTAÇÃO (ex.: "PREST.EMPREST 021/048" = parcela
  21 de 48; "016/030" = 16 de 30). O "valor" é o de UMA parcela. NÃO confunda com datas
  ("06/07" é dia/mês, não parcela). Se não for parcelado, use null nos dois.
- "desmarcar": true quando o item PROVAVELMENTE não deve entrar na conta do mês, mas você o
  extrai mesmo assim para o usuário decidir. Casos típicos: PAGAMENTO DE FATURA DE CARTÃO
  (ex.: "PGT.FATURA CARTAO"), TOTAL/SALDO DA FATURA ANTERIOR do cartão, transferência entre
  contas do PRÓPRIO titular, ou qualquer coisa que possa CONTAR EM DOBRO. Nesses casos, escreva
  em "observacao" um motivo curto (ex.: "pagamento da fatura", "total da fatura anterior",
  "transferência entre suas contas — pode contar em dobro"). Para lançamentos normais,
  "desmarcar":false e "observacao":"".
- IGNORE (não devolva): SALDO de conta corrente (saldo anterior/inicial/final da conta),
  limites, e os TOTAIS DA FATURA ATUAL (ex.: "total desta fatura", "total a pagar", "subtotal")
  — pois esses são a SOMA das compras que você já listou.
- Não invente nada. Se não conseguir ler, devolva {"lancamentos":[]}.`;

export async function POST(request) {
  try {
    // Aceita: arquivo binário (imagem/PDF) em base64, OU texto (CSV/OFX).
    // "imagemBase64" é mantido por compatibilidade com versões anteriores.
    const { base64, imagemBase64, mimeType, texto: textoArquivo } = await request.json();
    const dadosBase64 = base64 || imagemBase64;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { erro: "A chave da IA (GEMINI_API_KEY) não está configurada." },
        { status: 500 }
      );
    }
    if (!dadosBase64 && !textoArquivo) {
      return Response.json({ erro: "Nenhum arquivo foi enviado." }, { status: 400 });
    }

    // Monta a parte de conteúdo conforme o tipo: texto direto, ou arquivo embutido.
    const partesConteudo = textoArquivo
      ? [{ text: `Conteúdo do extrato/fatura (arquivo de texto, CSV ou OFX):\n${textoArquivo}` }]
      : [{ inline_data: { mime_type: mimeType || "image/png", data: dadosBase64 } }];

    const corpo = {
      contents: [{ parts: [{ text: INSTRUCAO }, ...partesConteudo] }],
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
