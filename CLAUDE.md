# Cofre — Painel financeiro pessoal

App de controle financeiro pessoal. **Frontend React puro conversando direto com Supabase** (sem servidor Node intermediário). Auth, RLS, lógica de negócio em RPCs PL/pgSQL. PWA instalável.

A segurança vem das **policies de Row Level Security** do Postgres — nunca de esconder dados. A `anon key` do Supabase é pública por design.

---

## Stack real (verificada)

| Camada | Tecnologia | Versão |
|---|---|---|
| Build | Vite | ^5.2 |
| UI | React | ^18.3 |
| Roteamento | react-router-dom | ^6.23 |
| Estilo | Tailwind CSS | ^3.4 |
| Ícones | lucide-react | ^0.383 |
| Gráficos | Recharts | ^2.12 |
| Datas | date-fns | ^3.6 |
| Planilhas | xlsx (SheetJS) | ^0.18 |
| Backend | @supabase/supabase-js | ^2.45 |
| Deploy | Vercel | — |
| Banco | Postgres (Supabase) | — |

**Não há TypeScript.** Tudo `.jsx` / `.js`. Não introduzir TS sem que seja pedido.

**Não há testes automatizados** (sem Jest/Vitest/Playwright). Não inventar testes a menos que seja pedido explicitamente.

**Não há gerenciador de estado externo** (sem Redux, Zustand, React Query). Só hooks + Context API.

---

## Estrutura real do projeto

```
frontend/
├── index.html              # HTML root, configura PWA (manifest, icons, fonts)
├── vite.config.js          # config mínima (porta 5173)
├── vercel.json             # SPA rewrite — /* → index.html
├── tailwind.config.js      # paleta accent/ink, sombras soft, gradientes
├── postcss.config.js
├── public/
│   ├── _redirects          # SPA fallback p/ Netlify-style
│   ├── manifest.json       # PWA manifest
│   ├── favicon.ico
│   └── icons/              # ícones PWA (72/96/128/144/152/180/192/384/512)
└── src/
    ├── main.jsx            # ReactDOM.createRoot
    ├── App.jsx             # rotas + Providers (Auth, Month, BrowserRouter)
    ├── context/
    │   ├── AuthContext.jsx     # user, login, register, logout
    │   └── MonthContext.jsx    # mês selecionado (YYYY-MM) + helpers
    ├── hooks/
    │   ├── useDashboard.js     # dados do dashboard p/ mês atual
    │   ├── useTransactions.js  # CRUD + togglePaid (otimista)
    │   ├── useDisclosure.js    # open/close/toggle p/ modais
    │   ├── useAlerts.js        # alertas computados de transações/cartões
    │   ├── useAutoRecurring.js # gera recorrências do mês ao mudar de mês
    │   └── useInstallPrompt.js # PWA install prompt
    ├── services/
    │   ├── supabase.js         # singleton do cliente Supabase
    │   ├── index.js            # transactionService, categoryService, cardService,
    │   │                       # recurringService, dashboardService
    │   ├── goals.js            # weeklyChallengeService, goalService, noteService
    │   ├── alerts.js           # service puro: gera lista de alertas
    │   ├── backup.js           # export/import JSON completo do usuário
    │   └── importExport.js     # CSV/XLSX
    ├── components/
    │   ├── Layout.jsx              # Sidebar + Header + Outlet + BottomNav + FAB
    │   ├── Sidebar.jsx             # desktop md+
    │   ├── MobileHeader.jsx        # mobile only
    │   ├── BottomNav.jsx           # mobile only
    │   ├── FloatingAddButton.jsx   # FAB de adicionar
    │   ├── ProtectedRoute.jsx      # redireciona /login se !user
    │   ├── Modal.jsx               # modal base (bottom-sheet no mobile, centered no desktop)
    │   ├── MonthSelector.jsx       # navegação ◀ mês ▶
    │   ├── StatCard.jsx            # card de KPI (balance|income|expense)
    │   ├── Charts.jsx              # MonthlyChart + CategoryChart (Recharts)
    │   ├── TransactionForm.jsx     # form principal (suporta parcelamento e recorrência)
    │   ├── TransactionList.jsx     # lista com togglePaid e ações
    │   ├── BatchTransactionForm.jsx # lançamento em massa
    │   ├── AlertCenter.jsx         # sino de alertas
    │   ├── ChangePasswordModal.jsx
    │   ├── GoalsList.jsx
    │   ├── WeeklyChallenge.jsx     # desafio 52 semanas
    │   ├── NotesEditor.jsx
    │   ├── InstallBanner.jsx       # banner "instalar app" PWA
    │   └── Toast.jsx               # toast top-right (desktop) / top (mobile)
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx           # rota /
    │   ├── TransactionListPage.jsx # /incomes e /expenses (mesma page, prop type)
    │   ├── Cards.jsx               # cartões + faturas + ciclos
    │   ├── Categories.jsx
    │   ├── Recurring.jsx           # modelos de transações recorrentes
    │   ├── Goals.jsx               # desafio 52 semanas + metas + notas
    │   ├── ImportExport.jsx
    │   └── Settings.jsx
    ├── utils/
    │   └── format.js               # formatCurrency, formatDate, parseAmount,
    │                               # generateInstallmentDates, splitInstallmentAmount
    └── styles/
        └── index.css               # @tailwind + @layer components (card-flat, btn-*, etc)

supabase/
├── schema.sql                              # base: tabelas, RLS, trigger, RPCs
└── migration_*.sql                         # rodadas em ordem cronológica:
    ├── migration_paid.sql                  # status pago/pendente em despesas
    ├── migration_monthly.sql               # filtros por mês nas RPCs
    ├── migration_installments.sql          # parcelamento (installment_group_id)
    ├── migration_recurring.sql             # tabela recurring_transactions + lazy gen
    ├── migration_recurring_kind.sql        # kind: 'recurring' | 'subscription'
    └── migration_card_smart_limit.sql      # limite do cartão considera só não-pagas
```

---

## Domínio: como o app pensa em dinheiro

### Regra mestra do saldo (LEIA ANTES DE MEXER NESSA LÓGICA)

```
saldo = Σ receitas − Σ despesas
```

**Toda despesa diminui o saldo no momento do cadastro**, independente da forma de pagamento (conta, débito, dinheiro **ou cartão de crédito**).

O cartão é uma "etiqueta organizacional" — permite ver fatura, limite e ciclo separadamente, mas **não muda o cálculo do saldo**. A motivação: evitar "falsa sensação de riqueza" quando o usuário gasta no cartão e o saldo continua alto.

Se algum código futuro contradisser isso ("subtrair só ao pagar a fatura"), o código está errado, não a regra.

### Mês como ciclo fechado

Toda a UI gira em torno do **mês selecionado** (`MonthContext`). Filtros, dashboards e listas respeitam esse mês. RPCs recebem `p_month` no formato `'YYYY-MM'`.

A pessoa pode navegar entre meses sem perder contexto — recorrências são geradas sob demanda quando ela abre um mês novo.

### Cartão: ciclo e limite

- `closing_day`: dia do mês em que a fatura fecha.
- `due_day`: dia em que vence.
- **Limite ocupado** = soma das compras NÃO PAGAS do cartão dentro do ciclo atual.
- Ao marcar uma compra como paga, ela deixa de ocupar limite (como o app do banco).
- Compras parceladas: só a parcela do ciclo atual ocupa limite; as futuras não.

A lógica vive em `get_card_summary()`, `get_card_bills()`, `pay_card_bill()` no SQL.

### Parcelamento

Cada parcela é uma **transação independente** em `transactions`, datada no mês correto. Todas compartilham `installment_group_id` (UUID). O `transactionService.createInstallments()` faz a divisão (com ajuste de centavos na primeira parcela) e a geração de datas (mantendo o dia, com fallback para último dia do mês).

### Recorrências (lazy generation)

`recurring_transactions` guarda **modelos** (templates). Quando o usuário abre um mês, o hook `useAutoRecurring` chama `recurringService.generateForMonth(month)` que cria as transações faltantes daquele mês — idempotente. Editar o modelo NÃO altera meses já gerados.

`kind` distingue `'recurring'` (aluguel, conta de luz, salário) de `'subscription'` (Netflix, Spotify). Empréstimos NÃO entram aqui — vão por parcelamento.

---

## Schema do Postgres (resumo)

### Tabelas

- **`categories`** — `user_id`, `name`, `type` ('income'|'expense'), `color`, `icon`. Unique em `(user_id, name, type)`. **Trigger** `create_default_categories()` cria 10 categorias ao fazer signup.
- **`credit_cards`** — `user_id`, `name`, `brand`, `last_digits`, `card_limit`, `closing_day`, `due_day`, `color`, `active`. Soft delete via `active = false`.
- **`transactions`** — `user_id`, `type`, `amount`, `description`, `date`, `category_id`, `credit_card_id?`, `paid`, `installment_total?`, `installment_number?`, `installment_group_id?`, `recurring_id?`.
- **`recurring_transactions`** — modelos: `day_of_month`, `start_month`, `kind`, `active`.
- Tabelas de Goals: `weekly_challenges`, `goals`, `notes` (ver `services/goals.js`).

### RLS

Todas as tabelas têm uma única policy `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Nunca passe `user_id` nos selects — o RLS filtra. Nos inserts, **é obrigatório** passar `user_id` (a `with check` exige).

### RPC functions (chamar via `supabase.rpc(name, args)`)

| Função | Retorna | Uso |
|---|---|---|
| `get_balance(p_month?)` | balance, total_income, total_expense | saldo total (ou do mês) |
| `get_period_summary(p_period, p_reference?)` | income, expense, balance, tx_count | day / week / month |
| `get_expenses_by_category(p_month?)` | category_id, name, color, icon, total, tx_count | gráfico pizza |
| `get_monthly_history(p_months)` | month, income, expense, balance | gráfico barras |
| `get_card_summary(p_card_id)` | card_limit, open_bill, paid_in_cycle, available, utilization_percent, cycle_start, cycle_end, ... | dashboard de cartão |
| `get_card_bills(p_card_id)` | bill_month, closes_on, due_on, total, paid, unpaid, is_fully_paid | lista de faturas |
| `get_card_bill_transactions(p_card_id, p_bill_month)` | transações de uma fatura | drill-down |
| `pay_card_bill(p_card_id, p_bill_month?)` | int (qtd. paga) | marca compras como pagas |
| `get_balance_forecast(p_months)` | month, projected, avg_income, avg_expense | projeção (média móvel) |
| `generate_recurring_for_month(p_month)` | int (qtd. criada) | idempotente |

---

## Convenções de código (siga sempre)

### Arquitetura

1. **Componentes NUNCA importam `supabase` diretamente** — sempre via um service em `src/services/`. (Exceção tolerada apenas para `supabase.auth.*` em `AuthContext` e `ChangePasswordModal`. Se ver isso fora desses dois, é dívida técnica a corrigir.)
2. **Acesso a tabelas vai pelos services** já existentes (`transactionService`, `categoryService`, `cardService`, `recurringService`, `dashboardService`, `weeklyChallengeService`, `goalService`, `noteService`).
3. **Lógica de domínio pesada vai em RPC SQL**, não em JS. Cálculos de saldo, ciclos de cartão, agregações — tudo no Postgres.
4. **Hooks (`use*`) encapsulam o fetching** + estado. Páginas e componentes consomem hooks, não chamam services diretamente quando há um hook equivalente.
5. **`MonthContext` é a fonte de verdade do mês selecionado.** Componentes que mostram dados temporais leem `useMonth()`.

### Estilo e nomenclatura

- Arquivos `.jsx` para componentes React, `.js` para utilitários/hooks/services.
- Componentes em **PascalCase** (`StatCard.jsx`), exportados como `default`.
- Hooks com prefixo `use` em camelCase (`useDashboard.js`), exportados como **named export**.
- Services exportados como objeto: `export const transactionService = { list, create, update, remove }`.
- Comentários em português, em blocos JSDoc-style explicando o "por quê", não o "o quê".
- Strings, mensagens de erro, labels — tudo em **português brasileiro**.

### React

- Function components. **Sem class components.**
- `useState` + `useEffect` + `useCallback` + `useMemo` quando precisa estabilizar referências.
- Atualizações otimistas para ações rápidas (ver `useTransactions.togglePaid`) — reverter se o servidor retornar erro.
- Não usar `React.memo` a menos que haja problema de performance medido.
- Modais via padrão `useDisclosure()` + `<Modal>`.

### Datas

- **Sempre** parsear `'YYYY-MM-DD'` como data local, não UTC. Use os helpers de `utils/format.js`. Brasil é UTC-3, então `new Date('2026-08-28')` vira 27/08 às 21h. Bug clássico — **não recriar**.
- Formato de armazenamento: sempre `'YYYY-MM-DD'` (ISO date, sem hora).
- Formato de exibição: pt-BR via `Intl.DateTimeFormat` (a `formatDate()` cuida).

### Dinheiro

- Armazenar como `numeric(12, 2)` no Postgres.
- No JS: número decimal. **Não usar** float arithmetic para divisão de parcelas — use `splitInstallmentAmount()` que trabalha em centavos.
- Formatar com `formatCurrency()` (BRL, pt-BR). Para valores grandes, opção `compact: true`.

---

## Design system (estado atual)

> ⚠️ **README e alguns comentários antigos descrevem "neo-brutalismo" (bordas grossas, sombras `4px 4px 0`).**
> **O design FOI atualizado** para um estilo moderno minimalista. Os artefatos remanescentes do brutalismo (ex.: `Toast.jsx` que ainda usa `border-2 border-ink-900 shadow-flat`) são **dívida técnica**.
>
> Ao criar UI nova, siga o estilo MODERNO descrito abaixo, não o brutalista.

### Paleta (em `tailwind.config.js`)

- **Accent** (verde-limão refinado): `#b8e94e` (DEFAULT), `#d0f078` (light), `#9bc92e` (dark).
- **Ink** (cinzas Zinc-like, 50→950): tons modernos, frios.
- **Semânticos**: `positive` `#10b981`, `negative` `#ef4444`, `warn` `#f59e0b`.

### Sombras

Sombras suaves, NÃO duras: `shadow-soft`, `shadow-soft-md`, `shadow-soft-lg`, `shadow-soft-xl`, `shadow-glow-accent`.

### Tipografia

Fonte única: **Plus Jakarta Sans** (importada do Google Fonts no `index.html`). Aliases: `font-display`, `font-body`, `font-mono`. Headings com `letter-spacing: -0.025em`.

### Componentes CSS prontos (`styles/index.css`)

`card-flat`, `btn-primary`, `btn-accent`, `btn-ghost`, `btn-danger`, `input-field`, `label`, `stat-number`, `fab`, `glass`. Use estes ao invés de recriar.

### Gradientes

`bg-gradient-dark`, `bg-gradient-accent`, `bg-gradient-card`, `bg-gradient-balance`, `bg-gradient-positive`, `bg-gradient-negative`, `bg-gradient-app`.

### Bordas e raios

`rounded-xl` (0.875rem), `rounded-2xl` (1.25rem), `rounded-3xl` (1.75rem).

### Animações

`animate-slide-up`, `animate-fade-in`, `animate-shimmer`. Classe `stagger` em containers anima filhos em sequência (`> *:nth-child(N)`).

### Responsividade

- **Mobile-first.** Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- Mobile usa `BottomNav` + `MobileHeader`; desktop usa `Sidebar`.
- Modais são **bottom sheet no mobile, centered no desktop** (`items-end md:items-center`).
- Inputs com `font-size: 16px` no mobile (evita zoom do iOS).
- `min-h-[44px]` em alvos de toque (acessibilidade iOS).
- `env(safe-area-inset-bottom)` em elementos fixos (FAB).

---

## Padrões de erro

- Services lançam exceções (`throw error`) — não retornam `{ error, data }`.
- Componentes envolvem com `try/catch`, mostram mensagem amigável em pt-BR.
- Casos especiais conhecidos:
  - Registro sem confirmação de email: `register()` lança `Error('CONFIRM_EMAIL')` — Login.jsx trata.
  - Falta de `.env`: log no console + UI fica quebrada (não há fallback).

---

## Variáveis de ambiente

Arquivo `.env` no `frontend/` (NÃO committar):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Lidas em `services/supabase.js` via `import.meta.env`.

---

## Como rodar e fazer deploy

### Local

```bash
cd frontend
npm install
npm run dev          # vite na porta 5173
```

### Build

```bash
npm run build        # gera dist/
npm run preview      # serve dist/ localmente
```

### Deploy

- **Vercel** com framework "vite". `vercel.json` já cuida do rewrite SPA.
- Variáveis de ambiente: configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel.
- Build command: `npm run build`. Output: `dist`.

### Setup do banco (em projeto Supabase novo)

1. Rodar `supabase/schema.sql` no SQL Editor.
2. Rodar as migrations em ordem cronológica (a ordem dos `migration_*.sql` aproxima da ordem real — quando em dúvida, todas são idempotentes).

---

## O que NÃO fazer

- ❌ Sugerir TypeScript, Redux, Zustand, React Query, SWR, axios — o projeto é deliberadamente enxuto.
- ❌ Sugerir backend Node (Express, Next.js API routes, Fastify) — o ponto é não ter backend.
- ❌ Mover lógica de negócio do SQL para o JS (saldo, fatura, ciclo) sem motivo forte.
- ❌ Esconder a `anon key` ou adicionar "camada de segurança" no frontend — RLS já é a camada.
- ❌ Quebrar a regra do saldo (cartão entra como saída imediata).
- ❌ Usar `new Date('YYYY-MM-DD')` direto — usar os helpers do `format.js`.
- ❌ Importar `supabase` em components — usar services.
- ❌ Recriar estilo "brutalista" (borda preta grossa, sombra dura `4px 4px 0`).
- ❌ Reintroduzir Fraunces / Inter / JetBrains Mono — só **Plus Jakarta Sans**.

---

## Dívidas técnicas conhecidas (oportunidades de melhoria)

1. **`TransactionForm.jsx` e `ChangePasswordModal.jsx` chamam `supabase` diretamente** — devem passar pelos services.
2. **`Toast.jsx` ainda usa estilo brutalista antigo** (`border-2 border-ink-900 shadow-flat`). Atualizar para `shadow-soft-lg` + `bg-gradient-card`.
3. **`README.md` descreve aesthetic neo-brutalista** — desatualizado.
4. Não há `.env.example` no repo.
5. Migrations não têm numeração — recomendável renomear para `001_paid.sql`, `002_monthly.sql`, etc.
6. Lógica grande em alguns componentes (`Recurring.jsx` ~48KB, `Cards.jsx` ~36KB, `BatchTransactionForm.jsx` ~24KB). Considerar quebrar em subcomponentes.

---

## Quando pedir mais contexto

- Antes de mexer em RPC SQL: leia `schema.sql` + a migration mais recente do tema (e.g. `migration_card_smart_limit.sql` antes de mexer em cartão).
- Antes de mexer em form de transação: revisitar a interação entre parcelamento, recorrência e pagamento via cartão (estes são mutuamente exclusivos em alguns casos).
- Antes de mexer em datas/timezone: ler os comentários em `utils/format.js` sobre o bug clássico UTC-3.
