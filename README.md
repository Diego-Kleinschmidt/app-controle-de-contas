# 💰 Controle de Contas

Aplicativo web para **controle mensal das contas da família** — feito para funcionar
bem no computador e no celular, com dados sincronizados na nuvem.

O foco é acompanhar, no dia a dia, **quanto já somam as contas do mês** (uma espécie de
"termômetro" da fatura), com a lógica de cartão de crédito: você lança agora, paga no mês seguinte.

> 🎓 Projeto desenvolvido durante os estudos (curso da Alura — "Projeto com IA"),
> como prática de desenvolvimento web moderno e uso de IA.

---

## ✨ Funcionalidades

- 🔐 **Login sem senha** (link mágico por e-mail via Supabase Auth)
- ➕ **Lançar receitas e despesas** com valor, data e responsável
- ✏️ **Editar** e 🗑️ **apagar** lançamentos
- 📊 **Total das contas do mês** em destaque, com entradas e saldo
- 📅 **Navegação entre meses** (lógica de fatura: abre já no mês seguinte)
- 🔁 **Contas recorrentes** (repetem automaticamente, ex.: luz, água, salário)
- 💳 **Compras parceladas** (geram uma parcela por mês, ex.: cartão em 10x)
- 👥 **Separação por responsável** (Diego / Mãe)
- 💵 **Campo de valor com máscara** brasileira (digite `7100` → vira `71,00`)
- 📱 **Responsivo** e com **tema claro/escuro** automático

## 🚧 Próximos passos (roadmap)

- 🤖 **Leitura do extrato por IA** (enviar o print do extrato e o Google Gemini
  cadastrar os gastos automaticamente)
- 👨‍👩‍👦 Opção de despesa **compartilhada** e cálculo de **acerto de contas**
- 🔑 Login com **Google**
- ☁️ **Deploy** na Vercel

---

## 🛠️ Tecnologias

- **[Next.js](https://nextjs.org/)** (React) — interface e estrutura
- **[Tailwind CSS](https://tailwindcss.com/)** — estilo e responsividade
- **[Supabase](https://supabase.com/)** — banco de dados (Postgres) e autenticação

---

## ▶️ Como executar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Configure as chaves do Supabase
#    Copie o arquivo de exemplo e preencha com as suas chaves
cp .env.example .env.local

# 3. Rode o projeto
npm run dev
```

Depois abra **http://localhost:3000** no navegador.

> Você precisa de um projeto no [Supabase](https://supabase.com/) com uma tabela
> `lancamentos`. O script de criação está em
> [`supabase/criar-tabela-lancamentos.sql`](./supabase/criar-tabela-lancamentos.sql).

---

## 📁 Estrutura do projeto

```
controle-contas/
├── app/                # Páginas (tela principal e login)
├── components/         # Componentes (painel de contas, formulário)
├── lib/                # Conexão com o Supabase e funções auxiliares
├── supabase/           # Script SQL para criar a tabela no banco
└── docs/               # Documentos de definição e modelagem do projeto
```

---

## 📚 Documentação do projeto

- [Definição do projeto](./docs/DEFINICAO-DO-PROJETO.md) — o "o quê" e o "para quem"
- [Modelo de dados](./docs/MODELO-DE-DADOS.md) — como as contas são guardadas

---

## 👤 Autor

**Diego Henrique Kleinschmidt**

Projeto de estudos — em desenvolvimento contínuo. 🚀
