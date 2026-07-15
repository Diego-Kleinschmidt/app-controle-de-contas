# 🗃️ Modelo de Dados — Controle de Contas

> Como cada lançamento é guardado no banco (Supabase / Postgres).
> Definido e validado com o Diego na Etapa 2.

## Tabela: `lancamentos`

Cada linha = uma conta lançada. Cada coluna = uma informação sobre ela.

| Coluna | Tipo | O que guarda | Exemplo |
|---|---|---|---|
| `id` | uuid (automático) | Identificador único da linha | `a1b2c3...` |
| `user_id` | uuid | Quem estava logado e lançou (para segurança/RLS) | (id do Diego) |
| `tipo` | texto | `receita` (entra) ou `despesa` (sai) | `despesa` |
| `descricao` | texto | Nome da conta | `Conta de luz` |
| `valor` | número (2 casas) | Valor em reais | `189.90` |
| `data` | data | Dia da conta / vencimento | `2026-07-10` |
| `mes_referencia` | texto | A qual mês pertence (formato `AAAA-MM`) | `2026-07` |
| `responsavel` | texto | De quem é o gasto | `diego` ou `mae` |
| `forma` | texto | Recorrência: `unica`, `recorrente` ou `parcelada` | `parcelada` |
| `parcela_atual` | número (opcional) | Qual parcela é (só se `parcelada`) | `3` |
| `parcela_total` | número (opcional) | Total de parcelas (só se `parcelada`) | `10` |
| `created_at` | data/hora (automático) | Quando foi criada | — |

## Como cobre os 4 tipos de lançamento

| Tipo (do documento) | Como fica |
|---|---|
| **Receita** | `tipo: receita`, `forma: unica` |
| **Despesa avulsa (extra)** | `tipo: despesa`, `forma: unica` |
| **Recorrente variável** (luz, água) | `forma: recorrente` — repete todo mês, ajustando o `valor` de cada mês |
| **Parcelada** (cartão em Nx) | `forma: parcelada` + `parcela_atual`/`parcela_total`; some ao quitar a última |

## Decisões registradas

- **Sem coluna `pago`** — mantido simples; toda despesa lançada já conta no mês.
- **Sem categorias** por enquanto (conforme o documento de definição).
- **`user_id` (quem lançou) ≠ `responsavel` (de quem é o gasto).** O Diego lança quase tudo,
  mas o `responsavel` separa o que é gasto dele e o que é da mãe.
- A lógica de **gerar automaticamente** as linhas dos meses seguintes (para `recorrente`
  e `parcelada`) será definida na Etapa 4, quando construirmos as telas. O modelo já suporta.

## Segurança (para lembrar na Etapa 3/4)

Vamos ativar **RLS (Row Level Security)** no Supabase para que só usuários logados
da família acessem os dados. Detalhado na hora.
