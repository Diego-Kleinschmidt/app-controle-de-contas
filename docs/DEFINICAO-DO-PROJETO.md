# 📋 Definição do Projeto — Controle Mensal de Contas

> Documento de premissas e requisitos do projeto.
> Serve como referência para todas as decisões futuras de desenvolvimento.

- **Autor:** Diego Henrique
- **Data de criação:** 13/07/2026
- **Status:** Definição inicial (versão 1)
- **Contexto:** Projeto de estudos (Alura — "Projeto com IA")

---

## 1. Visão geral (O quê e por quê)

Um **aplicativo web para controle mensal das contas** de uma família.
O objetivo é ter, de forma simples e visual, o controle de **quanto entra**, **quanto sai**
e **quanto sobra** a cada mês — funcionando bem tanto no computador quanto no celular.

### Problema que resolve
Hoje as contas da casa estão concentradas nos cartões do Diego, e a mãe dele
não tem visibilidade clara de quanto está gastando. O app resolve isso dando:
- Uma visão única e organizada das finanças do mês.
- A possibilidade de separar **o que é gasto do Diego** e **o que é gasto da mãe**,
  mesmo estando tudo nos mesmos cartões.

---

## 2. Para quem é (Público-alvo)

**Uso familiar** — poucas pessoas de confiança compartilhando o mesmo controle.

| Pessoa | Papel | O que faz |
|--------|-------|-----------|
| **Diego** | Gestor principal | Lança receitas e despesas, administra tudo. |
| **Mãe** | Acompanhante | Consulta principalmente os **gastos dela**, para saber quanto está gastando. |

> ⚠️ Não é um produto público/SaaS. É um app familiar, mas construído com boas práticas.

---

## 3. O que o app controla (Escopo funcional)

O app acompanha três coisas por mês:

1. **Receitas (entradas)** — o valor que a família recebe.
2. **Despesas fixas** — contas que se repetem todo mês.
3. **Despesas extras** — gastos avulsos e não recorrentes.

### 3.1. Tipos de lançamento (IMPORTANTE)

Esta é a parte mais delicada do projeto. Existem **quatro** situações diferentes:

| Tipo | Comportamento | Exemplo |
|------|---------------|---------|
| **Receita** | Valor que entra no mês. | Salário |
| **Despesa avulsa (extra)** | Acontece uma vez, num mês só. | Um jantar, uma roupa |
| **Despesa recorrente de valor variável** | Aparece **todo mês automaticamente**, mas o **valor muda** a cada mês (precisa ser informado/confirmado). | Conta de luz, conta de água |
| **Despesa parcelada** | Valor **fixo**, que se repete por um **número definido de parcelas** e depois **acaba sozinho**. | Compra no cartão em 10x |

> 💡 A grande diferença:
> - A conta **recorrente variável** nunca "termina" — repete indefinidamente, mudando o valor.
> - A compra **parcelada** tem começo e fim (ex.: parcela 3 de 10) e some quando quita.

### 3.2. Responsável pelo gasto ("de quem é")

Cada despesa é marcada como pertencente ao **Diego** ou à **Mãe**,
mesmo que tenha sido paga no cartão do Diego.

Isso permite:
- A mãe ver o **total só dos gastos dela**.
- O Diego ver o **total geral** da família.

### 3.3. 🤖 Leitura automática do extrato por IA (funcionalidade-destaque)

Esta é a funcionalidade que dá sentido ao nome "**Projeto com IA**".

Em vez de digitar cada gasto manualmente, o Diego **envia um print do extrato**
do cartão e a **IA lê a imagem e cadastra os gastos sozinha**.

**Como funciona (fluxo):**

```
📷 Print do extrato   →   🤖 IA lê a imagem   →   📝 Lista de gastos extraídos
   (app do banco)          (visão + texto)         (data, descrição, valor)
                                                          ↓
                              Diego revisa, ajusta e marca "Diego / Mãe"
                                                          ↓
                                                    💾 Salvo no mês
```

**Regras definidas:**
- **Origem da imagem:** print (captura de tela) do app do banco/cartão — texto nítido,
  ideal para a IA ler com precisão.
- **Sempre revisar antes de salvar:** a IA mostra tudo que leu; o Diego confere,
  corrige o que for preciso e marca de quem é cada gasto. Só então confirma.
  *(Nada entra automaticamente sem revisão — evita que um erro de leitura passe batido.)*
- **O que a IA deve extrair de cada linha:** data, descrição e valor.
- A marcação de **"de quem é" (Diego/Mãe)** continua sendo feita pela pessoa,
  pois a IA não tem como saber isso pelo extrato.

> 📌 **Ordem de construção:** primeiro a base do app funcionando com lançamento
> manual; **depois** plugamos a leitura por IA. Ver o roadmap na seção 9.

---

## 4. Tela principal (O que aparece ao abrir)

O destaque número 1 é o **Saldo do mês**:

```
┌─────────────────────────────────────┐
│  Julho / 2026                        │
│                                      │
│  Entradas:      R$ 5.000,00          │
│  Saídas:        R$ 3.200,00          │
│  ─────────────────────────           │
│  Saldo:         R$ 1.800,00  ✅      │
└─────────────────────────────────────┘
```

- Deve ser possível **navegar entre os meses** (ver julho, agosto, etc.).
- A lista de lançamentos do mês aparece abaixo do saldo.

---

## 5. Como funciona o acesso (Login)

- **Login com conta Google** (Diego e a mãe entram com o Google deles).
- Não precisa criar nem lembrar senha.
- Os dados são **compartilhados** entre os dois (é o controle da família).

---

## 6. Onde os dados ficam (Armazenamento)

- **Na nuvem, com sincronização.**
- Diego lança no celular → a mãe vê atualizado no computador dela, e vice-versa.
- Exige um backend/banco de dados online (definido na parte técnica abaixo).

---

## 7. Requisitos de funcionamento (Não-funcionais)

- ✅ **Responsivo / mobile-first**: funciona bem em qualquer tamanho de tela
  (celular, tablet, computador), independente do dispositivo.
- ✅ **Web em geral**: roda em qualquer navegador moderno, sem instalar nada.
- ✅ **Sincronização em tempo real** entre os dispositivos.
- ✅ **Simples e claro** — a mãe (não-técnica) precisa conseguir usar sem dificuldade.

---

## 8. Decisões técnicas (Stack)

> Ferramentas seguindo o **curso da Alura** — modernas, gratuitas para começar,
> populares no mercado e adequadas aos requisitos (nuvem + login Google + sincronização).

| Camada | Ferramenta | Para quê |
|--------|-----------|----------|
| **Interface (frontend)** | **React** (provavelmente com **Next.js**) | Montar as telas do app de forma organizada e reutilizável. |
| **Login** | **Supabase Auth** | Login com Google pronto e seguro. |
| **Banco de dados** | **Supabase** (banco Postgres na nuvem) | Guardar os dados na nuvem com sincronização entre os aparelhos. |
| **Hospedagem** | **Vercel** | Publicar o app na internet gratuitamente. |
| **Leitura do extrato (IA)** | **Google Gemini** (plano gratuito) | Ler o print do extrato e extrair os gastos (data, descrição, valor). Alternativa 100% grátis: **Tesseract.js** (OCR puro). |
| **Estilo/layout** | *(a definir)* | Deixar bonito e responsivo (ex.: CSS puro ou uma biblioteca de UI). |

> 🔒 **Nota importante sobre a IA:** a chave de acesso do Gemini **não pode**
> ficar exposta no app do navegador. Quando chegarmos nessa fase, a leitura da imagem
> será feita por uma pequena função no servidor (ex.: **Vercel Functions** ou
> **Supabase Edge Functions**), que recebe a imagem, chama a IA e devolve a lista de
> gastos. Isso será explicado na hora.

> 🎓 Como o Diego é iniciante, cada uma dessas escolhas será explicada
> passo a passo durante o desenvolvimento.

---

## 9. Roadmap por fases (Ordem de construção)

Construir por etapas para aprender com calma e ter algo funcionando cedo:

### ✅ Fase 1 — Base manual do app
- Login com Google.
- Lançar receitas e despesas manualmente (os 4 tipos).
- Marcar de quem é cada gasto (Diego/Mãe).
- Tela do saldo do mês + navegação entre meses.
- Dados na nuvem sincronizando entre os aparelhos.

### 🤖 Fase 2 — Leitura do extrato por IA (o "com IA")
- Enviar print do extrato.
- IA extrai os gastos (data, descrição, valor).
- Tela de revisão para conferir, ajustar e marcar de quem é, antes de salvar.

### 💡 Fase 3+ — Melhorias futuras (fora do escopo inicial)
- 🔕 **Notificações/lembretes de vencimento** (push no celular).
- 📊 **Categorias de gasto** (Mercado, Transporte, Lazer...) e gráficos.
- 📈 **Comparação histórica** entre vários meses.
- 🎯 **Metas e orçamento** por categoria.

> Cada fase pode ser adicionada sem refazer o que já existe.

---

## 10. Resumo das decisões (Checklist)

- [x] Público: uso **familiar** (Diego + mãe)
- [x] Controla: **receitas + despesas fixas + despesas extras**
- [x] Quatro tipos de lançamento: receita, extra, **recorrente variável**, **parcelada**
- [x] Separar gasto por pessoa (**Diego / Mãe**)
- [x] Tela principal: **saldo do mês** + navegação entre meses
- [x] Login: **Google**
- [x] Dados: **nuvem com sincronização**
- [x] Responsivo: **funciona em qualquer tela**
- [x] Stack: **React + Supabase + Vercel** (+ **Google Gemini** para a leitura por IA)
- [x] 🤖 **Leitura do extrato por IA** com print + revisão antes de salvar
- [x] Construção **em fases**: base manual primeiro, IA depois
- [x] Sem categorias e sem notificações **por enquanto**

---

*Este documento é vivo: à medida que o projeto evolui, ele pode (e deve) ser atualizado.*
